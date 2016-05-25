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

	global.Promise = require('bluebird');

	before(function() {
		server.listen(8088);
	});
	app.running_port = 8088;

	var Task = require('../socket/server/task')(io);

	var success = new Task('compilation', {
		filename: 'code.cpp',
		source: path.join(__dirname, 'compile_successful.cpp'),
		destination: '/tmp',
		compile: 'g++ -static -o code code.cpp'
	});
	var fail = new Task('compilation', {
		filename: 'code.cpp',
		source: path.join(__dirname, 'compile_error.cpp'),
		destination: '/tmp',
		compile: 'g++ -static -o code code.cpp'
	});
	Promise.all([
		it('Should return a valid file on compilation success', function() {
			this.timeout(10000);
			return new Promise(function(resolve, reject) {
				io.of('/judgers').once('connect', function a(client) {
					var pr = success.send(client.id, client);
					pr.then(function(data) {
						assert.equal(data.result, 0);
						assert.equal(data.file, '/tmp/code');
						assert.notProperty(data, 'err');
						resolve();
					}).error(reject);
				});
				var cl = require('../socket/judger/index')(null, app);
			});
		}),
		it('Should return an error when compilation fails', function() {
			this.timeout(10000);
			return new Promise(function(resolve, reject) {
				io.of('/judgers').once('connect', function b(client) {
					var pr = fail.send(client.id, client);
					pr.then(function(data) {
						assert.equal(data.result, 1);
						assert.notProperty(data, 'file');
						assert.property(data, 'err');
						resolve();
					}).error(reject);
				});
				var cl = require('../socket/judger/index')(null, app);
			});
		})
	]);
	after(function() {
		server.close();
	});
});
