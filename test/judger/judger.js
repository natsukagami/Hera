var chai = require('chai');
var assert = chai.assert;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

describe('Socket.io server and judge client', function() {
	var app = require('express')();
	var server = require('http').Server(app);
	var io = require('socket.io')(server);
	var fs = require('fs');
	var path = require('path');
	var temp = require('temp').track();
	var dir = temp.mkdirSync();
	var client;
	global.Promise = require('bluebird');

	before(function() {
		server.listen(8088);
		var pr = new Promise(function(resolve, reject) {
			io.of('/judgers').on('connection', function(c) {
				client = c; resolve();
			});
		});
		var cl = require('../../socket/judger/index')(null, 'localhost', app.running_port, '');
		return pr;
	});
	app.running_port = 8088;
	var Task = require('../../socket/server/task');
	var execute = new Task('evaluation', {
		source: path.join(dir, 'code'),
		input: path.join(__dirname, 'input.txt'),
		inputFile: 'stdin',
		output: path.join(__dirname, 'output.txt'),
		outputFile: 'stdout',
		time: 1,
		memory: 262144,
		scoreType: 'C3WordsIgnoreCase.dll'
	});
	var fail = new Task('compilation', {
		filename: 'code.cpp',
		source: path.join(__dirname, 'compile_error.cpp'),
		destination: dir,
		compile: 'g++ -static -O2 -o code code.cpp'
	});
	Promise.all([
		it('Should accept a file with correct output', function() {
			var compile = new Task('compilation', {
				filename: 'code.cpp',
				source: path.join(__dirname, 'compile_successful.cpp'),
				destination: dir,
				compile: 'g++ -static -O2 -o code code.cpp'
			});
			this.timeout(10000);
			return new Promise(function(resolve, reject) {
				var pr = compile.send(client.id, client);
				pr.then(function(data) {
					assert.propertyVal(data, 'result', 0);
					assert.propertyVal(data, 'file', path.join(dir, 'code'));
					assert.notProperty(data, 'err');
				}).then(function() {
					return execute.send(client.id, client);
				}).then(function(data) {
					assert.propertyVal(data, 'result', 'AC');
					assert.propertyVal(data, 'score', 1);
				}).then(resolve).catch(reject);
			});
		}),
		it('Should return WA for incorrect output', function() {
			var compile = new Task('compilation', {
				filename: 'code.cpp',
				source: path.join(__dirname, 'wrong_answer.cpp'),
				destination: dir,
				compile: 'g++ -static -O2 -o code code.cpp'
			});
			this.timeout(10000);
			return new Promise(function(resolve, reject) {
				var pr = compile.send(client.id, client);
				pr.then(function(data) {
					assert.propertyVal(data, 'result', 0);
					assert.propertyVal(data, 'file', path.join(dir, 'code'));
					assert.notProperty(data, 'err');
				}).then(function() {
					return execute.send(client.id, client);
				}).then(function(data) {
					assert.propertyVal(data, 'result', 'WA');
					assert.propertyVal(data, 'score', 0);
				}).then(resolve).catch(reject);
			});
		}),
		it('Should kill and return TLE on a file that runs forever', function() {
			var compile = new Task('compilation', {
				filename: 'code.cpp',
				source: path.join(__dirname, 'time_limit_exceed.cpp'),
				destination: dir,
				compile: 'g++ -static -O2 -o code code.cpp'
			});
			this.timeout(10000);
			return new Promise(function(resolve, reject) {
				var pr = compile.send(client.id, client);
				pr.then(function(data) {
					assert.propertyVal(data, 'result', 0);
					assert.propertyVal(data, 'file', path.join(dir, 'code'));
					assert.notProperty(data, 'err');
				}).then(function() {
					return execute.send(client.id, client);
				}).then(function(data) {
					assert.propertyVal(data, 'result', 'TLE');
					assert.propertyVal(data, 'score', 0);
				}).then(resolve).catch(reject);
			});
		}),
		it('Should return RTE on a file that terminated irregularly', function() {
			var compile = new Task('compilation', {
				filename: 'code.cpp',
				source: path.join(__dirname, 'runtime_error.cpp'),
				destination: dir,
				compile: 'g++ -static -O2 -o code code.cpp'
			});
			this.timeout(10000);
			return new Promise(function(resolve, reject) {
				var pr = compile.send(client.id, client);
				pr.then(function(data) {
					assert.propertyVal(data, 'result', 0);
					assert.propertyVal(data, 'file', path.join(dir, 'code'));
					assert.notProperty(data, 'err');
				}).then(function() {
					return execute.send(client.id, client);
				}).then(function(data) {
					assert.propertyVal(data, 'result', 'RTE');
					assert.propertyVal(data, 'score', 0);
				}).then(resolve).catch(reject);
			});
		}),
		it('Should return an error when compilation fails', function() {
			this.timeout(10000);
			return new Promise(function(resolve, reject) {
				var pr = fail.send(client.id, client);
				pr.then(function(data) {
					assert.equal(data.result, 1);
					assert.notProperty(data, 'file');
					assert.property(data, 'err');
					resolve();
				}).catch(reject);
			});
		}),
		it('Should have a stable and reliable queuing system', function() {
			this.timeout(20000);

			return new Promise(function(resolve, reject) {
				var does = [
					fail.send(client.id, client)
					.then(function(data) {
						assert.equal(data.result, 1);
						assert.notProperty(data, 'file');
						assert.property(data, 'err');
					}).catch(reject)
				];
				for (var i = 0; i < 10; ++i) {
					var compile = new Task('compilation', {
						filename: 'code.cpp',
						source: path.join(__dirname, 'compile_successful.cpp'),
						destination: dir,
						compile: 'g++ -static -O2 -o code code.cpp'
					});
					does.push(compile.send(client.id, client).then(function(data) {
						assert.propertyVal(data, 'result', 0);
						assert.propertyVal(data, 'file', path.join(dir, 'code'));
						assert.notProperty(data, 'err');
					}).then(function() {
						var execute = new Task('evaluation', {
							source: path.join(dir, 'code'),
							input: path.join(__dirname, 'input.txt'),
							inputFile: 'stdin',
							output: path.join(__dirname, 'output.txt'),
							outputFile: 'stdout',
							time: 1,
							memory: 262144,
							scoreType: 'C3WordsIgnoreCase.dll'
						});
						return execute.send(client.id, client);
					}).then(function(data) {
						assert.propertyVal(data, 'result', 'AC');
						assert.propertyVal(data, 'score', 1);
					}).catch(reject));
				}
				Promise.all(does).then(resolve);
			});
		})
	]);
	after(function() {
		server.close();
	});
});
