const dialog = Promise.promisifyAll(require('electron').dialog);
const fs = Promise.promisifyAll(require('fs-extra'));
const jszip = require('jszip');
jszip.external.Promise = GLOBAL.Promise = require('bluebird');
const temp = Promise.promisifyAll(require('temp')).track();
const path = require('path');
const zlib = Promise.promisifyAll(require('zlib'));
const xml2js = Promise.promisifyAll(require('xml2js'));
const xmlbuilder = require('xmlbuilder');
const walk = require('walk');
let app;

let webContents;

// Contest File logic

/**
 * Parses an XML file, deflated with zlib into a JSON object
 * @param  {Buffer} file 		The input file buffer
 * @return {Promise<Object>}	The output JSON object
 */
function zlibToXml(file) {
	return zlib.inflateAsync(file)
				.then(buf => {
					// Convert buffer to string
					return buf.toString();
				})
				.then(str => {
					// Convert XML string to JSON object
					return xml2js.parseStringAsync(str);
				})
				.catch(err => {
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
	let ret = {
		'students': {},
		'problems': {}
	};
	tasks.Tasks.Exam.forEach(exam => {
		let problem = {
			name: exam.$.Name,
			input: (exam.$.UseStdIn === 'false' ? exam.$.InputFile : 'stdin'),
			output: (exam.$.UseStdOut === 'false' ? exam.$.OutputFile : 'stdout'),
			score: Number(exam.$.Mark),
			timeLimit: Number(exam.$.TimeLimit),
			memoryLimit: Number(exam.$.MemoryLimit) * 1024,
			evaluator: exam.$.EvaluatorName,
			testcases: []
		};
		exam.TestCase.forEach(testcase => {
			let T = {
				name: testcase.$.Name,
				score: (testcase.$.Mark !== '-1' ? Number(testcase.$.Mark) : problem.score),
				timeLimit: (testcase.$.TimeLimit !== '-1' ? Number(testcase.$.TimeLimit) : problem.timeLimit),
				memoryLimit: (testcase.$.MemoryLimit !== '-1' ? Number(testcase.$.MemoryLimit) * 1024 : problem.memoryLimit)
			};
			if (testcase.$.Timelimit !== undefined) T.timeLimit = (testcase.$.Timelimit !== '-1' ? Number(testcase.$.Timelimit) : problem.timeLimit);
			problem.testcases.push(T);
		});
		ret.problems[exam.$.Name] = problem;
	});
	results.ContestResult.ContestantResult.forEach(studentResult => {
		let student = {
			name: studentResult.$.ContestantName,
			total: Number(studentResult.$.Evaluation),
			problems: {}
		};
		studentResult.ExamResult.forEach(examResult => {
			let pName = examResult.$.ExamName;
			if (examResult.$.State === '2') {
				// Compile Error
				student.problems[pName] = 'CE';
			} else if (examResult.$.State === '1') {
				// Compile Successful, with score
				student.problems[pName] = {
					score: Number(examResult.$.Evaluation),
					details: {}
				};
				examResult.TestResult.forEach((testResult, idx) => {
					let tests = student.problems[pName].details;
					let test = {
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
					let Regexes = [
						/Thời gian ≈ ([\d]+(?:\.[\d]+)?) giây\n(.+)/,
						/Chạy quá thời gian/,
						/(.+)\nThời gian chạy: \d+(?:\.\d+)?s \| Bộ nhớ: \d+ KBs/,
						/(.+)\n(.+)/
					];
					let matches;
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
	let Contest = {ContestResult: {}};
	let contestants = Contest.ContestResult.ContestantResult = [];
	Object.keys(contest.students).forEach(studentId => {
		let Student = contest.students[studentId];
		let student = {
			'@ContestantName': studentId,
			'@Evaluation': Student.total.toString(),
			'ExamResult': []
		};
		Object.keys(contest.problems).forEach(problemId => {
			let Problem = Student.problems[problemId];
			let problem = {
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
				Object.keys(Problem.details).forEach(testId => {
					let Test = Problem.details[testId];
					let test = {
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
	let Tasks = {Tasks: {}};
	let problems = Tasks.Tasks.Exam = [];
	Object.keys(contest.problems).forEach(problemId => {
		let Problem = contest.problems[problemId];
		let problem = {
			'@Name': problemId,
			'@InputFile': (Problem.input === 'stdin' ? problemId + '.inp' : Problem.input),
			'@UseStdIn': (Problem.input === 'stdin').toString(),
			'@OutputFile': (Problem.output === 'stdout' ? problemId + '.out' : Problem.output),
			'@UseStdOut': (Problem.output === 'stdout').toString(),
			'@EvaluatorName': Problem.evaluator,
			'@Mark': Problem.score.toString(),
			'@TimeLimit': Problem.timeLimit.toString(),
			'@MemoryLimit': (Problem.memoryLimit / 1024).toString(),
			'TestCase': []
		};
		Problem.testcases.forEach(testcase => {
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
	return temp.mkdirAsync('contest-').then(dir => {
		return fs	.readFileAsync(contestFile)
					.then(data => {
						// Read the content with jszip
						let contest = new jszip();
						return contest.loadAsync(data, { createFolders: true});
					})
					.then(contest => {
						// Unpack it to the desired temp folder
						let arr = [];
						contest.forEach((relPath, file) => {
							if (file.dir) {
								// Create the folders first
								arr.push(fs.mkdirAsync(path.join(dir, relPath)));
							}
						});
						return Promise.all(arr).then(() => { return contest; });
					})
					.then(contest => {
						let promises = [];
						contest.forEach((relPath, file) => {
							if (file.dir) return;
							// Update the progress bar
							webContents.send('judge-bar', {
								maxValue: ['add', 1]
							});
							// Write the file down
							promises.push(file.async('nodebuffer').then(data => {
								if (/Tasks\/(\w+)\/Test(\d+)\/\w+\.(inp|out)/i.test(relPath)) {
									let matches = /Tasks\/(\w+)\/Test(\d+)\/\w+\.(inp|out)/i.exec(relPath);
									relPath = path.join('Tasks', matches[1], 'Test' + matches[2], matches[1] + '.' + matches[3].toLowerCase());
								}
								return fs.ensureFileAsync(path.join(dir, relPath)).then(() => {
									return fs.writeFileAsync(path.join(dir, relPath), data);
								});
							}).then(() => {
								// TODO: Replace console.log with debug()
								console.log('Written ' + relPath);
								webContents.send('judge-bar', {
									value: ['add', 1]
								});
							}));
						});
						return Promise.all(promises).then(function() { contest = null; });
					})
					.then(() => {
						// Decode the data files
						let files = [
							fs.readFileAsync(path.join(dir, 'Contest.result'))
							.then(function(file) {
								return zlibToXml(file);
							}),
							fs.readFileAsync(path.join(dir, 'Tasks.config'))
							.then(function(file) {
								return zlibToXml(file);
							})
						];
						return Promise.all(files);
					})
					.then(function(object) {
						app.currentContest = parseContestResult(object[0], object[1]);
						app.currentContest.saved = true; // No modification is made
						app.currentContest.dir = dir;
						return app.currentContest;
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
	let dir = app.currentContest.dir;
	let files = convertToContestXML(app.currentContest);
	Promise.all([files['Contest.result'], files['Tasks.config']]).then(([result, config]) => {
		Promise.all([
			fs.writeFileAsync(path.join(dir, 'Contest.result'), result),
			fs.writeFileAsync(path.join(dir, 'Tasks.config'), config)
		]).then(() => {
			let zipFile = new jszip();
			let walker = walk.walk(dir, {});
			walker.on('file', (root, file, next) => {
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
			walker.on('end', () => {
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
				}, status => {
					let toSend = {
						value: ['set', status.percent]
					};
					if (status.currentFile !== null)
						toSend.status = 'Đang ghi file ' + status.currentFile + '...';
					webContents.send('judge-bar', toSend);
				}).then(buffer => {
					return fs.writeFileAsync(saveDir, buffer);
				}).then(() => {
					app.currentContest.saved = true;
					webContents.send('judge-bar', {
						status: 'Lưu file thành công'
					});
					zipFile = null;
					Promise.delay(3000).then(() => { webContents.send('judge-bar', 'reset'); });
				});
			});
		}).catch(err => {
			// TODO: Replace console.log with debug()
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
		]).then(() => {
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
