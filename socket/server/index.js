var socket = require('socket.io');
var Tasks, io;

module.exports = function(expressApp) {
	io = socket(expressApp);
	Tasks = require('./task')(io);
};
