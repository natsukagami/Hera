/**
 * Choose the current sandbox implementation of Hera
 * CURRENTLY USING BLANK SANDBOX (NO SECURITY)
 */
 var child_process = Promise.promisifyAll(require('child_process'));
 var temp = Promise.promisifyAll(require('temp')).track();
 var fs = Promise.promisifyAll(require('fs-extra'));
 var path = require('path');
 var os = require('os');
/**
 * The sandbox object
 * @param  {Object} options
 *  @param {String}  		cmd   The command to run
 *  @param {String}         input The input file name, or 'stdin'
 *  @param {String}        output The output file name, or 'stdout'
 *  @param {String}         cwd   The specified home directory for the command
 *  @param {Number}		    time  Time limit (in seconds)
 *  @param {Number}		  memory  Memory limit (in kB)
 *  @param {Boolean}       shell  Whether we call it in a shell or not (default False)
 */
var Sandbox = function(options) {
	this.dir = null;
	this._dir = null;
	this.prepared = false;
	this.inputStream = null;
	this.options = options;
};

/**
 * Prepares the sandbox
 * @return {Promise<>}
 */
Sandbox.prototype.prepare = function() {
	var inst = this;
	return temp.mkdirAsync('sandbox-').then(function(dirPath) {
		inst.dir = dirPath; inst._dir = dirPath;
		var files = [];
		// Copy the files out if we're running a submission instead of compiling
		if (inst.options.shell !== true) {
			files.push(fs.copyAsync(path.join(inst.options.cwd, inst.options.cmd),
				path.join(inst.dir, inst.options.cmd))
						.then(function() {
							if (os.platform() !== 'win32')
								fs.chmodAsync(path.join(inst.dir, inst.options.cmd), '755');
						}));
			if (os.platform() !== 'win32') inst.options.cmd = './' + inst.options.cmd;
		}
		else inst.dir = inst.options.cwd;
		if (inst.options.input !== 'stdin' && inst.options.input !== null)
			files.push(fs.copyAsync(path.join(inst.options.cwd, 'input.txt'), path.join(inst.dir, inst.options.input)));
		return Promise.all(files)
			.then(function() {
				return new Promise(function(resolve, reject) {
					inst.inputStream = (inst.options.input === 'stdin' ?
						fs.createReadStream(path.join(inst.options.cwd, 'input.txt')) :
						null);
					if (inst.inputStream === null) resolve();
					inst.inputStream.on('open', function() {
						resolve();
					});
				});
			})
			.then(function() {
				inst.prepared = true;
				console.log('Preparations completed');
			});
	});
};
/**
 * Runs the process
 * @return {Promise<{stdout, stderr, time, memory, exitcode, dir}>} The process' outputs
 */
Sandbox.prototype.run = function() {
	var done = [];
	var inst = this;
	console.log(this.options);
	if (this.options.shell !== true && (this.options.time === null || isNaN(Number(this.options.time)) ||
		this.options.memory === null || isNaN(Number(this.options.memory)))) return Promise.resolve({
			signal: '??',
			time: 0,
			memory: 0,
			exitcode: -1
		});
	if (!this.prepared) done = [this.prepare()];
	return Promise.all(done)
		.then(function() { return inst._run(); })
		.then(function(data) {
			console.log('Process terminated with exitcode ' + data.exitcode);
			return inst.cleanup(data).then(function() { return data; });
		});
};

/**
 * The sandbox's internal run() function. All sandboxes should only overload this.
 * @property dir         The directory to use
 * @property inputStream The input stream, if required (else it will be null)
 * @property options     The the options object in the Sandbox constructor
 * @return {Promise<{stdout, stderr, time, memory, exitcode, dir}>} The process' outputs
 */
Sandbox.prototype._run = function() {};

/**
 * Cleans the sandbox, for later use
 * @return {Promise}
 */
Sandbox.prototype.cleanup = function(data) {
	var files = [];
	var inst = this;
	if (this.options.output !== 'stdout' && data.exitcode === 0)
		files.push(
			fs.statAsync(path.join(this.dir, this.options.output))
			.then(function() {
				return fs.moveAsync(path.join(inst.dir, inst.options.output), path.join(inst.options.cwd, inst.options.output));
			})
			.catch(function(err) {
				console.log(err);
			}) // file not found, skip
		);
	return Promise.all(files).then(function() {
		fs.removeAsync(inst._dir);
		return;
	});
};

var CurrentSandbox = require('./blank_sandbox')(Sandbox);
if (os.platform() === 'win32') CurrentSandbox = require('./windows_sandbox')(Sandbox);
try {
	if (!child_process.execSync('isolate --init').error) {
		CurrentSandbox = require('./preinstalled_isolate_sandbox')(Sandbox);
		child_process.execSync('isolate --cleanup');
		console.log('isolate sandbox loaded');
	}
} catch (e) {
	// Pass
}

module.exports = CurrentSandbox;
