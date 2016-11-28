/**
 * The most basic implementation of a SANDBOX
 *
 * This provides absolutely no security, as it does not limit the memory resources
 * and any file / network access. It also does not monitor any time / memory consumption.
 */
var child_process = Promise.promisifyAll(require('child_process'));
var temp = Promise.promisifyAll(require('temp')).track();
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');
var os = require('os');

module.exports = function(Sandbox) {
	var BlankSandbox = function(options) {
		Sandbox.call(this, options);
	};
	BlankSandbox.prototype = Object.create(Sandbox.prototype);
	BlankSandbox.prototype.constructor = BlankSandbox;
	BlankSandbox.prototype._run = function() {
		var inst = this;
		return new Promise(function(resolve, reject) {
			var f = child_process.exec(
				inst.options.cmd,
				{
					cwd: inst.dir,
					timeout: inst.options.time * 1000 // In miliseconds
				},
				function(err, stdout, stderr) {
					if (err) reject(err, stdout, stderr);
					resolve(stdout, stderr);
				}
			);
			if (inst.inputStream !== null) inst.inputStream.pipe(f.stdin);
		}).then(function(stdout, stderr) {
			return {
				stdout: stdout,
				stderr: stderr,
				time: 0,
				memory: 0,
				exitcode: 0,
				dir: inst.dir
			};
		}).catch(function(error, stdout, stderr) {
			return {
				stdout: stdout,
				stderr: stderr,
				signal: (error.signal === 'SIGTERM' ? 'TLE' : 'RTE'),
				time: 0,
				memory: 0,
				err: error.toString(),
				exitcode: (error.code === null ? 127 : error.code),
				dir: inst.dir
			};
		});
	};
	return BlankSandbox;
};
