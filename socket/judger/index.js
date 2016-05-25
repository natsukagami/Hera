var electronApp, expressApp;
var client;

module.exports = function(electron, express) {
	electronApp = electron;
	expressApp = express;
	client = require('socket.io-client')('http://localhost:' + expressApp.running_port + '/judgers');
	require('./task')(client);
	return client;
};
