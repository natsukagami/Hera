var f = require('socket.io-client');

module.exports = function Judger(electron, host, port, uuid) {
	this.electronApp = electron;
	this.client = f('http://' + host + ':' + port + '/judgers', {
		'forceNew': true
	});
	require('./task')(this.client);
	var inst = this;
	this.client.on('authorize', function() {
		inst.client.emit('authorize', uuid);
	});
	this.client.on('message', function(msg) {
		inst.client.emit('message', msg);
	});
};
