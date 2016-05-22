var socket = require('socket.io');
var app;

module.exports = function(expressApp) {
	app = socket(expressApp);
};
