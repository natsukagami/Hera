var fs = Promise.promisifyAll(require('fs-extra'));
var cp = Promise.promisifyAll(require('child_process'), {
	multiArgs: true
});
var path = require('path');
var IDLE_SANDBOXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

module.exports = function(Sandbox) {
	var IsolateSandbox = function(options) {
		Sandbox.call(this, options);
	};
	var BlankSandbox = require('./blank_sandbox')(Sandbox);
	IsolateSandbox.prototype = Object.create(Sandbox.prototype);
	IsolateSandbox.prototype.constructor = IsolateSandbox;
	IsolateSandbox.prototype._prepareSandbox = function() {
		var inst = this;
		this.sandboxId = IDLE_SANDBOXES.shift();
		return cp.execAsync('isolate --init -b ' + this.sandboxId + ' --cg')
				.then(function(stds) {
					var stdout = stds;
					inst.sandboxDir = path.join(stdout.replace('\n', ''), 'box', 'dir');
					var files = [fs.moveAsync(
						inst.dir,
						inst.sandboxDir
					)];
					if (inst.options.input === 'stdin') {
						files.push(fs.copyAsync(path.join(inst.options.cwd, 'input.txt'), path.join(inst.sandboxDir, '_in.txt')));
					}
					return Promise.all(files).catch(function(err) {
						console.log(err);
						throw err;
					});
				});
	};
	IsolateSandbox.prototype._cleanSandbox = function() {
		var inst = this;
		return fs.removeAsync(this.dir)
				.then(function() {
					return fs.moveAsync(inst.sandboxDir, inst.dir);
				})
				.then(function() {
					cp.execAsync('isolate --cleanup -b ' + inst.sandboxId).then(function() {
						IDLE_SANDBOXES.push(inst.sandboxId);
					});
				});
	};
	IsolateSandbox.prototype._run = function() {
		var inst = this;
		if (this.options.shell === true) {
			// Shell forced? Use blank sandbox
			return BlankSandbox.prototype._run.call(this);
		}
		return this._prepareSandbox()
				.then(function() {
					// Executes the task
					var cmd = 'isolate --run --cg' +
					' -c ' + 'dir' +
					' -b ' + inst.sandboxId + // Box id
					' -M ' + path.join(inst.sandboxDir, '_meta.txt') + // Writes metadata to file
					' -t ' + inst.options.time +
					' -w ' + (2 * Number(inst.options.time)) +
					' -x 1 ' +
					' -k 262144' +
					' -o ' + 'dir/_out.txt' +
					' -r ' + 'dir/_err.txt';
					if (inst.options.input === 'stdin')
						cmd += ' -i dir/_in.txt';
					cmd += ' ' + inst.options.cmd;
					console.log('Executing ' + cmd + '...');
					return cp.execAsync(cmd);
				})
				.catch(function(err) { }) // Throws the signal stuff
				.then(function() {
					// Reads the streams
					return Promise.all([
						fs.readFileAsync(path.join(inst.sandboxDir, '_out.txt'), 'utf8'),
						fs.readFileAsync(path.join(inst.sandboxDir, '_err.txt'), 'utf8'),
						fs.readFileAsync(path.join(inst.sandboxDir, '_meta.txt'), 'utf8')
					]);
				})
				.then(function(streams) {
					var [stdout, stderr, meta] = streams;
					var opt = {};
					meta.split('\n').map(function(line) {
						var [name, val] = line.split(':');
						opt[name] = val;
					});
					opt['status'] = (opt['status'] ? opt['status'] : 'OK');
					opt['status'] = (opt['status'] === 'TO' ? 'TLE' : opt['status']);
					opt['status'] = (opt['status'] === 'RE' || opt['status'] === 'SG' ? 'RTE' : opt['status']);
					opt['exitcode'] = (
						opt['exitcode'] ?
						opt['exitcode'] :
						(opt['status'] === 'OK' ? 0 : -1)
					);
					return {
						stdout: stdout,
						stderr: stderr,
						signal: opt.status,
						time: Number(opt.time),
						memory: Number(opt['cg-mem']),
						err: opt.message,
						exitcode: opt.exitcode,
						dir: inst.dir
					};
				})
				.finally(function() {
					return inst._cleanSandbox();
				});
	};
	return IsolateSandbox;
};
