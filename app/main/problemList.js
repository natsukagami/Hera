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
var contest, app;

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
			'@MemoryLimit': (testcase.memoryLimit === Problem.memoryLimit ?
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
					score: (testcase.$.Mark !== '-1' ? Number(testcase.$.Mark) : problem.score),
					timeLimit: (testcase.$.TimeLimit !== '-1' ? Number(testcase.$.TimeLimit) : problem.timeLimit),
					memoryLimit: (testcase.$.MemoryLimit !== '-1' ? Number(testcase.$.MemoryLimit) * 1024 : problem.memoryLimit)
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
	walker.on('end', function() {
		// use the powerful powerfulDetector to match input - output pairs!
		var detector = new powerfulDetector(filelist);
		var list = detector.extractIOList();
		parseConfig(dirpath, path.parse(dirpath).name).then(function(config) {
			console.log(config);
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
					});
		});
	});
}

module.exports = function(electronApp, ipc) {
	app = electronApp;
	app.startupPromise.then(function() {
		contest = app.currentContest;
	});
	webContents = app.mainWindow.webContents;
	ipc.on('add-problem', function() {
		dialog.showOpenDialog({
			title: 'Thêm bài tập',
			properties: ['openDirectory']
		}, addProblem);
	});
};
