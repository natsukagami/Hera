var dialog = Promise.promisifyAll(require('electron').dialog);
var fs = Promise.promisifyAll(require('fs-extra'));
var jszip = require('jszip');
jszip.external.Promise = GLOBAL.Promise = require('bluebird');
var temp = Promise.promisifyAll(require('temp')).track();
var path = require('path');
var zlib = Promise.promisifyAll(require('zlib'));
var xml2js = Promise.promisifyAll(require('xml2js'));
var xmlbuilder = require('xmlbuilder');
var walk = require('walk');
var app;

var webContents;

// Contest File logic

/**
 * Parses an XML file, deflated with zlib into a JSON object
 * @param  {Buffer} file 		The input file buffer
 * @return {Promise<Object>}	The output JSON object
 */
function zlibToXml(file) {
	return zlib	.inflateAsync(file)
				.then(function(buf) {
					// Convert buffer to string
					buf = buf.toString();
					return buf;
				})
				.then(function(str) {
					// Convert XML string to JSON object
					return xml2js.parseStringAsync(str);
				})
				.catch(function(err) {
					// Handle any error
					dialog.showErrorBoxAsync(
						'Lỗi',
						'Không thể dịch file kết quả và các file cấu hình. Phải chăng file .contest bị lỗi?'
					);
					return err;
				});
}

/**
 * Convert an XML string / buffer into Zlib-compressed buffer
 * @param {[string / buffer]} buffer the XML string / buffer to be converted
 * @return {Promise<Buffer>}
 */
function XmltoZlib(buffer) {
	return zlib.deflateAsync(buffer);
}

/**
 * Parse contest result (Contest.result file) into Hera-readable JS object
 * @param  {Object} results The Contest.result file, decoded
 * @return {Object}         Hera-readable Contest object
 */
function parseContestResult(results, tasks) {
	var ret = {
		'students': {},
		'problems': {}
	};
	tasks.Tasks.Exam.forEach(function(exam) {
		var problem = {
			name: exam.$.Name,
			input: (exam.$.UseStdIn === 'false' ? exam.$.InputFile : 'stdin'),
			output: (exam.$.UseStdOut === 'false' ? exam.$.OutputFile : 'stdout'),
			score: Number(exam.$.Mark),
			timeLimit: Number(exam.$.TimeLimit),
			memoryLimit: Number(exam.$.MemoryLimit) * 1024,
			evaluator: exam.$.EvaluatorName,
			testcases: []
		};
		exam.TestCase.forEach(function(testcase) {
			problem.testcases.push({
				name: testcase.$.Name,
				score: (testcase.$.Mark !== '-1' ? Number(testcase.$.Mark) : problem.score),
				timeLimit: (testcase.$.TimeLimit !== '-1' ? Number(testcase.$.TimeLimit) : problem.timeLimit),
				memoryLimit: (testcase.$.MemoryLimit !== '-1' ? Number(testcase.$.MemoryLimit) * 1024 : problem.memoryLimit)
			});
		});
		ret.problems[exam.$.Name] = problem;
	});
	results.ContestResult.ContestantResult.forEach(function(studentResult) {
		var student = {
			name: studentResult.$.ContestantName,
			total: Number(studentResult.$.Evaluation),
			problems: {}
		};
		studentResult.ExamResult.forEach(function(examResult) {
			var pName = examResult.$.ExamName;
			if (examResult.$.State === '2') {
				// Compile Error
				student.problems[pName] = 'CE';
			} else if (examResult.$.State === '1') {
				// Compile Successful, with score
				student.problems[pName] = {
					score: Number(examResult.$.Evaluation),
					details: {}
				};
				examResult.TestResult.forEach(function(testResult, idx) {
					var tests = student.problems[pName].details;
					var test = {
						name: testResult.$.TestName,
						score: Number(testResult.$.Evaluation),
						maxScore: ret.problems[pName].testcases[idx].score,
						result: testResult.$.EvaluationText,
						time: 0,
						memory: 0
					};
					tests[testResult.$.TestName] = test;
					if (testResult.$.RunningTime !== undefined) {
						test.time = Number(testResult.$.RunningTime);
					}
					if (testResult.$.MemoryUsed !== undefined) {
						test.memory = Number(testResult.$.MemoryUsed);
					}
					// Let's try parsing the result text
					// Themis' result text are in one of the following format:
					var Regexes = [
						/Thời gian ≈ ([\d]+(?:\.[\d]+)?) giây\n(.+)/,
						/Chạy quá thời gian/,
						/(.+)\nThời gian chạy: \d+(?:\.\d+)?s \| Bộ nhớ: \d+ KBs/,
						/(.+)\n(.+)/
					];
					var matches;
					if (Regexes[2].test(test.result)) {
						matches = Regexes[2].exec(test.result);
						test.result = matches[1];
					} else if (Regexes[0].test(test.result)) {
						matches = Regexes[0].exec(test.result);
						test.result = matches[2];
						test.time = Number(matches[1]);
					} else if (Regexes[1].test(test.result)) {
						test.time = ret.problems[pName].testcases[idx].timeLimit;
					} else if (Regexes[3].test(test.result)) {
						matches = Regexes[3].exec(test.result);
						test.result = matches[1] + ' (' + matches[2] + ')';
					}
				});
			}
		});
		ret.students[studentResult.$.ContestantName] = student;
	});
	return ret;
}

/**
 * Convert the current app.currentContest into Tasks.config and Contest.result
 * @param  {Object<Contest>} contest 	Hera-readable JS object
 * @return {Object { 'Contest.result': Promise<Buffer>, 'Tasks.config': Promise<Buffer> }}
 */
function convertToContestXML(contest) {
	var Contest = {ContestResult: {}};
	var contestants = Contest.ContestResult.ContestantResult = [];
	Object.keys(contest.students).forEach(function(studentId) {
		var Student = contest.students[studentId];
		var student = {
			'@ContestantName': studentId,
			'@Evaluation': Student.total.toString(),
			'ExamResult': []
		};
		Object.keys(contest.problems).forEach(function(problemId) {
			var Problem = Student.problems[problemId];
			var problem = {
				'@ExamName': problemId,
				'@State': (
					Problem === undefined ? 3 :
					(
						Problem === 'CE' ? 2 : 1
					).toString()
				)
			};
			if (problem['@State'] === '1') {
				problem['@Evaluation'] = Problem.score.toString();
				problem['TestResult'] = [];
				Object.keys(Problem.details).forEach(function(testId) {
					var Test = Problem.details[testId];
					var test = {
						'@TestName': testId,
						'@Evaluation': Test.score.toString(),
						'@RunningTime': Test.time.toString(),
						'@MemoryUsed': Test.memory.toString(),
						'@EvaluationText': (Test.result +
							'\nThời gian chạy: ' +
							(Math.round(Test.time * 1000) / 1000).toString() +
							's | Bộ nhớ: ' + Test.memory.toString() +
							' KBs'
						)
					};
					problem.TestResult.push(test);
				});
			}
			student.ExamResult.push(problem);
		});
		contestants.push(student);
	});
	Contest = xmlbuilder.create(Contest).toString();
	var Tasks = {Tasks: {}};
	var problems = Tasks.Tasks.Exam = [];
	Object.keys(contest.problems).forEach(function(problemId) {
		var Problem = contest.problems[problemId];
		var problem = {
			'@Name': problemId,
			'@InputFile': (Problem.input === 'stdin' ? '' : Problem.input),
			'@UseStdIn': (Problem.input === 'stdin').toString(),
			'@OutputFile': (Problem.output === 'stdout' ? '' : Problem.output),
			'@UseStdOut': (Problem.output === 'stdout').toString(),
			'@EvaluatorName': Problem.evaluator,
			'@Mark': Problem.score.toString(),
			'@TimeLimit': Problem.timeLimit.toString(),
			'@MemoryLimit': (Problem.memoryLimit / 1024).toString(),
			'TestCase': []
		};
		Problem.testcases.forEach(function(testcase) {
			problem.TestCase.push({
				'@Name': testcase.name,
				'@Mark': (testcase.score === Problem.score ? -1 : testcase.score).toString(),
				'@TimeLimit': (testcase.timeLimit === Problem.timeLimit ? -1 : testcase.timeLimit).toString(),
				'@MemoryLimit': (testcase.memoryLimit === Problem.memoryLimit ?
					-1 :
					(testcase.memoryLimit / 1024)).toString()
			});
		});
		problems.push(problem);
	});
	Tasks = xmlbuilder.create(Tasks).toString();
	return {
		'Contest.result': XmltoZlib(Contest),
		'Tasks.config': XmltoZlib(Tasks)
	};
}

/**
 * Send the contest data to the renderer
 * @param  {HeraContest} contestData [description]
 * @return Nothing
 */
function sendToRenderer(contestData) {
	// Send contest data to renderer
	webContents.send('reload-table', {
		students: contestData.students,
		problems: contestData.problems
	});
}

/**
 * Does the unpacking of the *.contest file
 * into a temporary folder.
 * @param  {ElectronApp} 	app         [description]
 * @param  {string} 		contestFile [description]
 * @return {Promise<>}      [description]
 */
function unpackContest(app, contestFile) {
	// Send an alert to change the loading bar
	webContents.send('judge-bar', {
		status: 'Đang giải nén file ' + contestFile + '...',
		value: ['set', 0],
		maxValue: ['set', 1],
		mode: 'determinate'
	});
	return temp.mkdirAsync('contest-').then(function(dir) {
		return fs	.readFileAsync(contestFile)
					.then(function(data) {
						return data;
					})
					.then(function(data) {
						// Read the content with jszip
						var contest = new jszip();
						return contest.loadAsync(data, { createFolders: true});
					})
					.then(function(contest) {
						// Unpack it to the desired temp folder
						contest.forEach(function(relPath, file) {
							if (file.dir) {
								// Create the folders first
								fs.mkdirSync(path.join(dir, relPath));
							}
						});
						var promises = [];
						contest.forEach(function(relPath, file) {
							if (file.dir) return;
							// Update the progress bar
							webContents.send('judge-bar', {
								maxValue: ['add', 1]
							});
							// Write the file down
							promises.push(file.async('nodebuffer').then(function(data) {
								if (/Tasks\/(\w+)\/Test(\d+)\/\w+\.(inp|out)/i.test(relPath)) {
									var matches = /Tasks\/(\w+)\/Test(\d+)\/\w+\.(inp|out)/i.exec(relPath);
									relPath = path.join('Tasks', matches[1], 'Test' + matches[2], matches[1] + '.' + matches[3].toLowerCase());
								}
								return fs.ensureFileAsync(path.join(dir, relPath)).then(function() {
									return fs.writeFileAsync(path.join(dir, relPath), data);
								});
							}).then(function() {
								console.log('Written ' + relPath);
								webContents.send('judge-bar', {
									value: ['add', 1]
								});
							}));
						});
						return Promise.all(promises).then(function() { contest = null; });
					})
					.then(function() {
						// Decode the data files
						var files = [
							fs.readFileAsync(path.join(dir, 'Contest.result'))
							.then(function(file) {
								return zlibToXml(file);
							}),
							fs.readFileAsync(path.join(dir, 'Tasks.config'))
							.then(function(file) {
								return zlibToXml(file);
							})
						];
						return Promise.all(files)
							.then(function(object) {
								app.currentContest = parseContestResult(object[0], object[1]);
								app.currentContest.saved = true; // No modification is made
								app.currentContest.dir = dir;
								return app.currentContest;
							})
							.catch(function(err) {
								dialog.showErrorBoxAsync(
									'Lỗi',
									'Không thể mở file: ' + err.toString()
								);
								return err;
							});
					})
					.then(sendToRenderer)
					.catch(function(err) {
						dialog.showErrorBoxAsync(
							'Lỗi',
							'Không thể mở file: ' + err.toString()
						).then(function() {
							app.quit();
						});
					});
	}).error(function(err) {
		dialog.showErrorBoxAsync(
			'Out of memory',
			'Your temp folder has ran out of memory. Hera will now quit.'
		).then(function() {
			app.quit();
		});
	});
}

/**
 * Packs the current contest into a .contest file on saveDir
 * @param  {ElectronApp} 	app         [description]
 * @param  {string} 		saveDir 	[description]
 * @return Nothing
 */
function packContest(app, saveDir) {
	webContents.send('judge-bar', {
		status: 'Đang lưu lại kì thi...',
		value: ['set', 0],
		maxValue: ['set', 1],
		mode: 'determinate'
	});
	var dir = app.currentContest.dir;
	var files = convertToContestXML(app.currentContest);
	Promise.all([files['Contest.result'], files['Tasks.config']]).then(function(f) {
		Promise.all([
			fs.writeFileAsync(path.join(dir, 'Contest.result'), f[0]),
			fs.writeFileAsync(path.join(dir, 'Tasks.config'), f[1])
		]).then(function() {
			var zipFile = new jszip();
			var walker = walk.walk(dir, {});
			walker.on('file', function(root, file, next) {
				file = file.name;
				webContents.send('judge-bar', {
					maxValue: ['add', 1]
				});
				zipFile.file(path.join(path.relative(dir, root), file), fs.createReadStream(path.join(root, file)));
				webContents.send('judge-bar', {
					value: ['add', 1]
				});
				next();
			});
			walker.on('end', function() {
				webContents.send('judge-bar', {
					status: 'Đang ghi kì thi ra file...',
					value: ['set', 0],
					maxValue: ['set', 100],
					mode: 'determinate'
				});
				zipFile.generateAsync({
					type: 'nodebuffer',
					platform: process.platform,
					compression: 'DEFLATE',
					compressionOptions: {
						level: 6
					}
				}, function update(status) {
					var toSend = {
						value: ['set', status.percent]
					};
					if (status.currentFile !== null)
						toSend.status = 'Đang ghi file ' + status.currentFile + '...';
					webContents.send('judge-bar', toSend);
				}).then(function(buffer) {
					return fs.writeFileAsync(saveDir, buffer);
				}).then(function() {
					app.currentContest.saved = true;
					webContents.send('judge-bar', {
						status: 'Lưu file thành công'
					});
					zipFile = null;
					setTimeout(function() { webContents.send('judge-bar', 'reset'); }, 3000);
				});
			});
		}).catch(function(err) {
			console.log(err);
		});
	});
}

function emptyTemp(app) {
	if (app.currentContest.saved || dialog.showMessageBox({
		type: 'warning',
		buttons: ['Có', 'Không'],
		defaultId: 0,
		title: 'Chưa lưu file hiện tại',
		message: 'Bạn chưa lưu lại kì thi đang mở. Lưu lại trước khi tiếp tục?',
		cancelId: 1
	})) {
		temp.cleanupSync();
		return true;
	} else {
		doSaveContest();
		return false;
	}
}

/**
 * Create an empty contest
 * @return {Promise<Contest>} The new empty contest
 */
function createEmptyContest() {
	return temp.mkdirAsync('contest-').then(function(dir) {
		return Promise.all([
			fs.mkdirAsync(path.join(dir, 'Contestants')),
			fs.mkdirAsync(path.join(dir, 'Tasks'))
		]).then(function() {
			return {
				students: {},
				problems: {},
				dir: dir,
				saved: true
			};
		});
	}).then(function(contest) {
		sendToRenderer(contest);
		return contest;
	});
}

/**
 * Do the contest-saving work
 * @return {string} the path where the contest was saved, or null if it was cancelled
 */
function doSaveContest() {
	dialog.showSaveDialog({
		title: 'Lưu lại kì thi',
		filters: [
			{ name: 'Themis/Hera Contest', extensions: ['contest'] }
		]
	}, function(path) {
		if (path === null || path === undefined) return null;
		console.log('Saving contest to ' + path);
		packContest(app, path);
		return path;
	});
}

module.exports = function(electronApp, ipc) {
	// Register the current contest with null
	app = electronApp;
	app.startupPromise = createEmptyContest().then(function(contest) {
		app.currentContest = contest;
	});
	webContents = app.mainWindow.webContents;
	app.sendContestToRenderer = sendToRenderer;
	ipc.on('file-open-contest', function() {
		if (emptyTemp(app)) dialog.showOpenDialogAsync({
			title: 'Mở kì thi cũ',
			filters: [
				{ name: 'Themis/Hera Contest', extensions: ['contest'] }
			],
			properties: ['openFile']
		}).catch(function(filepath) {
			// Since the electron function does not call func(err, res), we use
			// .catch instead of .then to get the first argument
			console.log('Opening ' + filepath[0]);
			unpackContest(app, filepath[0]).then(function() {
				console.log('Unpacking Done');
				webContents.send('judge-bar', {
					status: 'Mở file thành công',
					value: ['add', 1]
				});
				setTimeout(function() { webContents.send('judge-bar', 'reset'); }, 3000);
			});
		});
	});
	ipc.on('file-save-contest', doSaveContest);
	ipc.on('file-new-contest', function() {
		if (emptyTemp(app)) createEmptyContest().then(function(contest) {
			app.currentContest = contest;
		});
	});
	app.on('before-quit', function(event) {
		if (!emptyTemp(app)) event.preventDefault();
	});
};
