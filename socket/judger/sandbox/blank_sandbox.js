/**
 * The most basic implementation of a SANDBOX
 *
 * This provides absolutely no security, as it does not limit the memory resources
 * and any file / network access. It also does not monitor any time / memory consumption.
 */
var child_process = Promise.promisifyAll(require('child_process'));

/**
 * The sandbox object
 * @param  {Object} options
 *  @param {String}  		cmd   The command to run
 *  @param {ReadableStream} input The input source stream, NULL if there isn't any
 *  @param {String}         cwd   The specified home directory for the command
 *  @param {Number}		    time  Time limit (in seconds)
 *  @param {Number}		  memory  Memory limit (in kB)
 */
var Sandbox = function(options) {
	return {
		/**
		 * Prepares the sandbox
		 * @return {None}
		 */
		prepare: function() {

		},
		/**
		 * Runs the process
		 * @return {Promise<{stdout, stderr, time, memory, exitcode}>} The process' outputs
		 */
		run: function() {
			return child_process.execAsync(
				options.cmd,
				{
					cwd: options.cwd,
					timeout: options.time * 1000 // In miliseconds
				}
			).then(function(stdout, stderr) {
				return {
					stdout: stdout,
					stderr: stderr,
					time: 0,
					memory: 0,
					exitcode: 0
				};
			}).error(function(error, stdout, stderr) {
				console.log(error);
				return {
					stdout: stdout,
					stderr: error.signal,
					time: 0,
					memory: 0,
					exitcode: error.code
				};
			});
		},
		/**
		 * Cleans the sandbox, for later use
		 * @return {None}
		 */
		cleanup: function() {

		}
	};
};

module.exports = Sandbox;
