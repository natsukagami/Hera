/**
 * The sandbox implementation on Windows, provided by Kien Nguyen Tien Trung (@kc97ble)
 *
 */

var child_process = Promise.promisifyAll(require('child_process'));
var fs = Promise.promisifyAll(require('fs-extra'));
var os = require('os');
var path = require('path');
var Registry = require('winreg');
var eol = require('eol');

if (os.platform() !== 'win32') {
	throw new Error('This sandbox is not supported on non-win32 platform');
}

module.exports = function(Sandbox) {
	var WindowsSandbox = function(options) {
		Sandbox.call(this, options);
	};
	var _execute = function(inst) {
		console.log('Executing "' + inst.options.cmd + '"...');
		return new Promise(function(resolve, reject) {
			var command = 'sandbox';
			if (inst.options.memory !== undefined)
				command = command + ' -m ' + inst.options.memory * 1024;
			if (inst.options.time !== undefined)
				command = command + ' -t ' + inst.options.time * 1000;
			if (inst.options.shell === true) command = command + ' "cmd /c ' + inst.options.cmd + ' 2> nul"';
			else command += ' "' + inst.options.cmd + '"';
			var f = child_process.exec(
				command,
				{
					cwd: inst.dir
				},
				function(err, stdout, stderr) {
					resolve([stdout, stderr]);
				}
			);
			if (inst.inputStream !== null) inst.inputStream.pipe(f.stdin);
		});
	};
	WindowsSandbox.prototype = Object.create(Sandbox.prototype);
	WindowsSandbox.prototype.constructor = WindowsSandbox;
	WindowsSandbox.prototype._run = function() {
		var inst = this;
		var registry = new Registry({
			hive: Registry.HKCU,
			key: '\\Software\\Microsoft\\Windows\\Windows Error Reporting'
		});
		var setAsync = Promise.promisify(registry.set, {
			context: registry
		});
		return setAsync('DontShowUI', 'REG_DWORD', 1)
		.then(function() {
			return fs.copyAsync(path.join(__dirname, 'binaries', 'win32', 'sandbox.exe'), path.join(inst.dir, 'sandbox.exe'));
		})
		.then(function() { return _execute(inst); })
		.spread(function(stdout, stderr) {
			var attr = {};
			eol.lf(stderr).split('\n').forEach(function(line) {
				if (line === '') return;
				var f = line.split('=');
				attr[f[0]] = f[1];
			});
			console.log(attr);
			return {
				stdout: stdout,
				stderr: stderr,
				time: Number(attr['EXECUTION_TIME']) / 1000,
				memory: Math.round(Number(attr['MEMORY_USED']) / 1024),
				exitcode: (attr['VERDICT'] === 'OK' ? 0 : 1),
				signal: attr['VERDICT'],
				err: stderr
			};
		}).finally(function(data) {
			return setAsync('DontShowUI', 'REG_DWORD', 0)
					.then(function() { return data; });
		});
	};
	return WindowsSandbox;
};
