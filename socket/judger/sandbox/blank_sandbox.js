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
	var dir, _dir;
	var prepared = false;
	var inputStream;
	return {
		/**
		 * Prepares the sandbox
		 * @return {Promise<>}
		 */
		prepare: function() {
			return temp.mkdirAsync('sandbox-').then(function(dirPath) {
				dir = dirPath; _dir = dirPath;
				var files = [];
				// Copy the files out if we're running a submission instead of compiling
				if (options.shell !== true) {
					files.push(fs.copyAsync(path.join(options.cwd, options.cmd), path.join(dir, options.cmd))
								.then(function() {
									if (os.platform !== 'win32')
										fs.chmodAsync(path.join(dir, options.cmd), '755');
								}));
					if (os.platform !== 'win32') options.cmd = './' + options.cmd;
				}
				else dir = options.cwd;
				console.log(dir, options.cwd);
				if (options.input !== 'stdin' && options.input !== null)
					files.push(fs.copyAsync(path.join(options.cwd, options.input), path.join(dir, options.input)));
				return Promise.all(files)
					.then(function() {
						return new Promise(function(resolve, reject) {
							inputStream = (options.input === 'stdin' ?
								fs.createReadStream(path.join(options.cwd, 'input.txt')) :
								null);
							if (inputStream === null) resolve();
							inputStream.on('open', function() {
								resolve();
							});
						});
					})
					.then(function() { prepared = true; });
			});
		},
		/**
		 * Runs the process
		 * @return {Promise<{stdout, stderr, time, memory, exitcode, dir}>} The process' outputs
		 */
		run: function() {
			var done = [];
			var inst = this;
			if (!prepared) done = [this.prepare()];
			return Promise.all(done).then(function() {
				return new Promise(function(resolve, reject) {
					var f = child_process.exec(
						options.cmd,
						{
							cwd: dir,
							timeout: options.time * 1000 // In miliseconds
						},
						function(err, stdout, stderr) {
							if (err) reject(err, stdout, stderr);
							resolve(stdout, stderr);
						}
					);
					if (inputStream !== null) inputStream.pipe(f.stdin);
				});
			}).then(function(stdout, stderr) {
				return {
					stdout: stdout,
					stderr: stderr,
					time: 0,
					memory: 0,
					exitcode: 0,
					dir: dir
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
					dir: dir
				};
			}).then(function(data) {
				return inst.cleanup().then(function() { return data; });
			});
		},
		/**
		 * Cleans the sandbox, for later use
		 * @return {Promise}
		 */
		cleanup: function() {
			var files = [];
			if (options.output !== 'stdout')
				files.push(fs.copyAsync(path.join(dir, options.output), path.join(options.cwd, options.output)));
			return Promise.all(files).then(function() { return fs.removeAsync(_dir); });
		}
	};
};

module.exports = Sandbox;
