var socket = require('socket.io');
var io;

module.exports = function(electronApp, expressApp) {
	io = socket(expressApp);
	electronApp.enqueue = require('./queue')(electronApp, io.of('/judgers'));
	electronApp.judgeClient = require('../judger/index')(electronApp, expressApp);
};
