var { dialog } = require('electron');
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');
var walk = require('walk');
var zlib = Promise.promisifyAll(require('zlib'));
var xml2js = Promise.promisifyAll(require('xml2js'));
var xmlbuilder = require('xmlbuilder');
var sprintf = require('sprintf-js').sprintf;
var powerfulDetector = require('./libs/powerful-detector/powerfulDetector');
var webContents;
var app, ipc;

/**
 * Writes the config into a zlib-encoded file
 * @param  {Object} config The config object to be written
 * @param  {String} file   The file path to be written
 * @return {Promise<>}     The promise of the work
 */
function writeConfig(config, file) {
	var Problem = config;
	var problem = {
		'@Name': Problem.name,
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
			'@MemoryLimit': (testcase.memoryLimit === Problem.memoryLimit || testcase.memoryLimit === -1 ?
				-1 :
				(testcase.memoryLimit / 1024)).toString()
		});
	});
	if (problem.TestCase.length === 0) delete problem.TestCase;
	return zlib.deflateAsync(xmlbuilder.create({
		ExamInformation: [problem]
	}).toString()).then(function(buf) {
		return fs.writeFileAsync(file, buf);
	});
}

/**
 * Parses the config file
 * @param  {string} dirpath 	The directory of the problem
 * @param  {string} problemName The name of the problem, should be auto-recognized as the folder name
 * @return {Promise<Object>}	The config object
 */
function parseConfig(dirpath, problemName) {
	// The `Settings.cfg` file within the problem's folder should have all the things we need
	// Unfortunately it's also zlib-encoded just as with `Contest.result` and `Tasks.config`
	return fs.lstatAsync(path.join(dirpath, 'Settings.cfg'))
		.then(function(stat) {
			// The file does exist
			// We do the unzlibbing and XML-to-JS-ing then
			return fs.readFileAsync(path.join(dirpath, 'Settings.cfg'))
					.then(zlib.inflateAsync)
					.then(function(buf) {
						return buf.toString();
					})
					.then(xml2js.parseStringAsync);
		}).then(function(exam) {
			exam = exam.ExamInformation;
			// XML object
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
					score: Number(testcase.$.Mark),
					timeLimit: Number(testcase.$.TimeLimit),
					memoryLimit: Number(testcase.$.MemoryLimit)
				});
			});
			return problem;
		})
		.error(function(err) {
			if (err.errno === -2) {
				// No file found
				var config = {
					name: problemName,
					input: 'stdin',
					output: 'stdout',
					score: 100,
					timeLimit: 1, // 1s
					memoryLimit: 256 * 1024, // 256 mb
					evaluator: 'C3WordsIgnoreCase.dll', // diff -W
					testcases: []
				};
				return writeConfig(config, path.join(dirpath, 'Settings.cfg'))
						.then(function() { return config; });
			} else throw err;
		});
}

/**
 * Copies the current test folder into temp currentContest folder
 * @param  {String} dirpath 	The problem folder
 * @param  {String} problemName	Name of the problem, for test parsing
 * @param  {[String]} filelist	The array of files to be copied over
 * @param  {[String]} testlist 	The array of recognized tests to be reformatted
 * @return {Promise<>}      	Promise of the process
 */
function copyConfig(dirpath, problemName, filelist, testlist) {
	webContents.send('judge-bar', {
		status: 'Đang thêm bài tập...'
	});
	var Copied = {};
	return Promise.all(testlist.map(function(test) {
		var inpDir = path.join(dirpath, test[0]);
		var outDir = path.join(dirpath, test[1]);
		var filepath = path.join(app.currentContest.dir, 'Tasks', problemName, test[2]);
		return Promise.all([
			fs.ensureFileAsync(path.join(filepath, problemName + '.inp'))
				.then(function() {
					return fs.copyAsync(inpDir, path.join(filepath, problemName + '.inp'), { clobber: true });
				})
				.then(function() { Copied[inpDir] = true; }),
			fs.ensureFileAsync(path.join(filepath, problemName + '.out'))
				.then(function() {
					return fs.copyAsync(outDir, path.join(filepath, problemName + '.out'), { clobber: true });
				})
				.then(function() { Copied[outDir] = true; })
		]);
	})).then(function() {
		return Promise.all(filelist.map(function(file) {
			var filepath = path.join(app.currentContest.dir, 'Tasks', problemName, path.relative(dirpath, file));
			if (Copied[file]) return;
			return fs.ensureFileAsync(filepath)
					.then(function() {
						return fs.copyAsync(file, filepath, { clobber: true });
					})
					.then(function() {
						webContents.send('judge-bar', {
							value: ['add', 1]
						});
					});
		}));
	}).then(function() {
		webContents.send('judge-bar', {
			status: 'Thêm bài tập thành công',
			value: ['add', 1]
		});
		setTimeout(function() { webContents.send('judge-bar', 'reset'); }, 3000);
	}).error(function(err) {
		dialog.showErrorBox(
			'Lỗi',
			'Không thể mở thư mục bài tập: ' + err.toString()
		);
	});
}

function addProblem(dirpath) {
	if (dirpath === undefined) return;
	dirpath = dirpath[0];
	// Start the job
	webContents.send('judge-bar', {
		status: 'Đang xử lí thư mục bài tập...',
		value: ['set', 0],
		maxValue: ['set', 1],
		mode: 'determinate'
	});
	// Scan the dir for folders
	var walker = walk.walk(dirpath);
	var filelist = [];
	walker.on('file', function(root, file, next) {
		file = path.join(root, file.name);
		filelist.push(file); next();
	});
	// Send the number of files to judge bar
	webContents.send('judge-bar', {
		maxValue: ['add', filelist.length]
	});
	walker.on('end', function() {
		// use the powerful powerfulDetector to match input - output pairs!
		var detector = new powerfulDetector(filelist);
		var list = detector.extractIOList();
		parseConfig(dirpath, path.parse(dirpath).name).then(function(config) {
			list.forEach(function(item, idx, arr) {
				var caseName = sprintf('Test%02d', idx);
				arr[idx] = [
					path.relative(dirpath, item[0]),
					path.relative(dirpath, item[1]),
					caseName
				];
				if (idx >= config.testcases.length) {
					config.testcases.push({
						name: caseName,
						score: -1,
						timeLimit: -1,
						memoryLimit: -1
					});
				}
			});
			return writeConfig(config, path.join(dirpath, 'Settings.cfg'))
					.then(function() {
						webContents.send('add-problem-drawer', list, config);
						// Setting change listeners
						ipc.on('problem-testcase-change', function(event, data) {
							config.testcases.forEach(function(testcase) {
								if (testcase.name === data.testcase) {
									testcase[data.field] = Number(data.value);
								}
							});
						});
						ipc.on('add-problem-testcase-flip', function(event, data) {
							list.forEach(function(testcase, idx, arr) {
								if (testcase[2] === data) {
									arr[idx] = [
										testcase[1],
										testcase[0],
										testcase[2]
									];
								}
							});
						});
						ipc.on('problem-general-change', function(event, data) {
							config[data.field] = data.value;
						});
						// Confirms and end the problem adding procedure
						ipc.once('add-problem-add', function(event) {
							ipc.removeAllListeners('problem-testcase-change');
							ipc.removeAllListeners('problem-general-change');
							ipc.removeAllListeners('add-problem-testcase-flip');
							app.currentContest.saved = false;
							copyConfig(dirpath, config.name, filelist, list).then(function() {
								config.testcases.forEach(function(testcase) {
									testcase.score = (testcase.score === -1 ? config.score : testcase.score);
									testcase.timeLimit = (testcase.timeLimit === -1 ? config.timeLimit : testcase.timeLimit);
									testcase.memoryLimit = (testcase.memoryLimit === -1 ? config.memoryLimit : testcase.memoryLimit);
								});
								app.currentContest.problems[config.name] = config;
								app.sendContestToRenderer(app.currentContest);
							});
						});
					});
		});
	});
}

module.exports = function(electronApp, ipcMain) {
	app = electronApp;
	ipc = ipcMain;
	webContents = app.mainWindow.webContents;
	ipc.on('add-problem', function() {
		dialog.showOpenDialog({
			title: 'Thêm bài tập',
			properties: ['openDirectory']
		}, addProblem);
	});
	ipc.on('config-problem', function(event, problem) {
		var config = app.currentContest.problems[problem.problem];
		webContents.send('config-problem-drawer', config);
		ipc.on('problem-testcase-change', function(event, data) {
			config.testcases.forEach(function(testcase) {
				if (testcase.name === data.testcase) {
					testcase[data.field] = Number(data.value);
				}
			});
			app.currentContest.saved = false;
		});
		ipc.on('problem-general-change', function(event, data) {
			config[data.field] = data.value;
			app.currentContest.saved = false;
		});
		ipc.once('config-problem-save', function() {
			ipc.removeAllListeners('problem-testcase-change');
			ipc.removeAllListeners('problem-general-change');
			config.testcases.forEach(function(testcase) {
				testcase.score = (testcase.score === -1 ? config.score : testcase.score);
				testcase.timeLimit = (testcase.timeLimit === -1 ? config.timeLimit : testcase.timeLimit);
				testcase.memoryLimit = (testcase.memoryLimit === -1 ? config.memoryLimit : testcase.memoryLimit);
			});
		});
	});
};
