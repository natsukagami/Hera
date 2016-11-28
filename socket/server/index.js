var socket = require('socket.io');
var Judger = require('../judger/index');
var os = require('os');
var io;

global.maxQueueLength = Math.max(3, os.cpus().length) - 2;

module.exports = function(electronApp, expressApp) {
	io = socket(expressApp);
	electronApp.enqueue = require('./queue')(electronApp, io.of('/judgers'));
	electronApp.judgeClient = [];
	for (var i = 0; i < global.maxQueueLength; ++i)
		electronApp.judgeClient.push(new Judger(electronApp, 'localhost', expressApp.running_port, electronApp.uuid));
};
