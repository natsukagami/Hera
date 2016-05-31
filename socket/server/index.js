var socket = require('socket.io');
var Judger = require('../judger/index');
var os = require('os');
var io;

module.exports = function(electronApp, expressApp) {
	io = socket(expressApp);
	electronApp.enqueue = require('./queue')(electronApp, io.of('/judgers'));
	electronApp.judgeClient = [];
	for (var i = 0; i < 1; ++i)
		electronApp.judgeClient.push(new Judger(electronApp, 'localhost', expressApp.running_port, electronApp.uuid));
};
