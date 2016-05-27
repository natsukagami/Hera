/**
 * Splits a submission judge into tasks with judger manager
 */

var app, io;
var uuid = require('uuid');
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');
var temp = require('temp');
var os = require('os');
var webContents;
var queue = [];
var promise_queue = require('promise-queue');
var taskQueue = new promise_queue(1, Infinity);
var Task;

const acceptedLanguages = [
	{
		name: 'C++',
		ext: '.cpp',
		compile: 'g++ -O2 -static -o code code.cpp'
	}
]; // Should not be here

/**
 * Pushes a task into the queue
 * @param  {Task} task         The task to be pushed
 * @return {Promise<>}         The chained promise of the completed task
 */
function pushToQueue(task) {
	return taskQueue.add(function() {
		webContents.send('judge-bar', {
			status: 'Tiến trình: ' + task.message + '...'
		});
		var client = queue.shift();
		queue.push(client);
		return task.send(client.id, client);
	}).then(function(data) {
		webContents.send('judge-circle', {
			value: ['add', 1]
		});
		return task.nextTask(data);
	});
}

/**
 * Judges a student's submission on a problem
 * @param  {Object} student    [description]
 * @param  {Object} problem    [description]
 * @return {Promise<>}         [description]
 */
function make_task(student, problem) {
	var ret; // The promise to return
	var taskDir;
	webContents.send('judge-circle', {
		maxValue: ['add', problem.testcases.length + 1]
	});
	student.problems[problem.name] = undefined;
	ret = acceptedLanguages.map(function(lang) {
		return fs.statAsync(path.join(app.currentContest.dir, 'Contestants', student.name, problem.name + lang.ext))
		.then(function(stat) {
			if (!stat.isFile()) return;
			return temp.mkdirAsync('queue-');
		})
		.then(function(dir) {
			// Prepare the tasks
			taskDir = dir;
			var compile = new Task(
				'compilation', {
					source: path.join(app.currentContest.dir, 'Contestants', student.name, problem.name + lang.ext),
					destination: dir,
					filename: 'code' + lang.ext,
					compile: lang.compile
				}
			);
			compile.message = 'Biên dịch bài ' + problem.name + ' của ' + student.name;
			var testcases = problem.testcases.map(function(testcase) {
				return new Task('evaluation', {
					source: path.join(dir, 'code'),
					input: path.join(app.currentContest.dir, 'Tasks', problem.name, testcase.name, problem.name + '.inp'),
					output: path.join(app.currentContest.dir, 'Tasks', problem.name, testcase.name, problem.name + '.out'),
					inputFile: problem.input,
					outputFile: problem.output,
					time: testcase.timeLimit,
					memory: testcase.memoryLimit,
					scoreType: problem.evaluator
				});
			});
			compile.nextTask = function(data) {
				if (data.result !== 0) {
					// Compile error
					student.problems[problem.name] = 'CE';
					app.sendContestToRenderer(app.currentContest);
					webContents.send('judge-bar', 'reset');
					webContents.send('judge-circle', {
						value: ['add', testcases.length]
					});
					return;
				}
				student.problems[problem.name] = {
					score: 0,
					details: {}
				};
				if (testcases.length) return pushToQueue(testcases[0]);
			};
			problem.testcases.forEach(function(testcase, id) {
				testcases[id].nextTask = function(data) {
					student.problems[problem.name].score += testcase.score * data.score;
					student.problems[problem.name].details[testcase.name] = {
						name: testcase.name,
						score: testcase.score * data.score,
						maxScore: testcase.score,
						result: data.judgeReturns,
						time: data.time,
						memory: data.memory
					};
					if (testcases.length > id + 1) return pushToQueue(testcases[id + 1]);
					else {
						app.sendContestToRenderer(app.currentContest);
						webContents.send('judge-bar', 'reset');
					}
				};
				testcases[id].message = 'Chấm bài ' + problem.name + ' của ' + student.name + ' (' + testcase.name + ')';
			});
			return pushToQueue(compile);
		})
		.error(function(err) {
			/* pass, file not found */
			if (err.code === 'ENOENT') return;
			else throw err;
		})
		.finally(function(data) {
			return fs.removeAsync(taskDir).then(function() { return data; });
		});
	});
	return Promise.all(ret);
}

/**
 * Runs the judge on an array of submissions
 * @param  {Array<{problem, student}>} submits The array of submissions
 * @return {Promise<>} All
 */
function run_judge(submits) {
	if (taskQueue.getQueueLength() === 0 && taskQueue.getPendingLength() === 0) webContents.send('judge-circle', {
		mode: 'determinate',
		maxValue: ['set', 0],
		value: ['set', 0]
	});
	return Promise.all(submits.map(function(submit) {
		return make_task(submit.student, submit.problem);
	}));
}

module.exports = function(electronApp, socketIoApp) {
	app = electronApp;
	webContents = app.mainWindow.webContents;
	io = socketIoApp;
	Task = require('./task')(io);
	app.uuid = uuid.v4(); // Give the app an unique id, so that only verified clients can connect
	io.on('connect', function(client) {
		var timer = setTimeout(client.disconnect, 10000);
		client.emit('authorize');
		client.once('authorize', function(id) {
			if (id !== app.uuid) { // Rejects the client
				client.disconnect();
				return;
			}
			console.log('Client ' + client.id + ' connected');
			clearTimeout(timer);
			queue.push(client); // Puts client into queue
		});
	});
	return run_judge;
};
