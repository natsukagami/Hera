var socket = require('socket.io');
var io;

module.exports = function(expressApp) {
	io = socket(expressApp);
};
