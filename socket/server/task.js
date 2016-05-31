/**
 * Contains the task promise structure
 *
 * The judging task will consist of two parts:
 *  - Compilation
 *  - Evaluation (for each testcase)
 *
 * For each part, we provide a listener on completion, offering the availability
 * of the next part.
 */
var socketio = require('socket.io');
var ss = require('socket.io-stream');
var uuid = require('uuid');
var fs = require('fs');
var path = require('path');

/**
 * A task consists of 5 phases
 *  - Server sends the task signature to one of the judgers, which would be put into their queues.
 *  Within 60 seconds if the judge is still not responding we restart the task.
 *  - Judger sends 'online' message, server sends raw data.
 *  - Judger sends 'ready' message, server sends file streams.
 *  - Upon completion of file sending, the judger has 20 seconds to finish the given task. If the task
 *  is not completed within time, we restart the task.
 *  - Judger sends back the results, the task ends.
 */

/**
 * The task object
 * @param  {String} type    The task type. Can be either 'compilation' or 'evaluation'
 * @param  {Object} options Task options.
 *     - For 'compilation' tasks, the option should provide
 *      + @property {String}	filename 		The file name
 *     	+ @property {String}	source    		The path of the source code
 *     	+ @property {String}	graderName  	The name of the grader file, if required [optional]
 *     	+ @property {String}	grader    		The path code for the grader, if required [optional]
 *     	+ @property {String}	compile  		The command for compilation
 *     	+ @property {String}	destination 	The directory to save the compiled binary
 *     - For 'evaluation' tasks, the option should provide
 *      + @property {String}	source  		The path of the binary executable file
 *      + @property {String}	input   		The path of the input file
 *      + @property {String}    inputFile      The name of the expected input file, or 'stdin'
 *      + @property {String}	output  		The path of the expected output file
 *      + @property {String}    outputFile      The name of the expected output file, or 'stdout'
 *      + @property {Number}	time    		The time limit
 *      + @property {Number}	memory  		The memory limit
 *      + @property {String}	scoreType  		The scoring method
 *      + @property {String}	scorer  		The path of the binary executable scorer [optional]
 * @return {Promise<Object>} The task result
 *     - For 'compilation' tasks, the object should provide
 *      + @property {Int}            result  The compilation result (0 for success, 1 for error)
 *      + @property {String} 		  file    In case of success, path of the compiled binary file
 *      + @property {String}		  err     In case of failure, a string containing the error
 *     - For 'evaluation' tasks, the object should provide
 *      + @property {string}         result   The judging result (AC, WA, TLE, MLE, RTE, PS) (PS = Partially scored)
 *      + @property {string}    judgeReturns  Any additional output of the scorer [optional]
 *      + @property {Number}		  score   The score of the test (between 0 and 1)
 *      + @property {Number}		  time    The running time of the code (in seconds)
 *      + @property {Number}		  memory  The used memory of the code (in kB)
 *   * If the task did not end in time, an error will be emitted
 */
var Task = function(type, options) {
	this.type = type;
	this.options = options;
	this.uuid = uuid.v4(); // Give the task a random id
	this.nextTask = null;
	/**
	 * send the task to a client, receiving results from it or cancel after a timeout
	 * @param  {String} receiver Id of the receiver (as a socket.io client)
	 * @return {Promise<Object>} A promise of type above
	 */
};

Task.prototype.send = function(receiver, _socket) {
	var inst = this;
	var socket = _socket;
	return new Promise(function(resolve, reject) {
		inst.timeout = setTimeout(function() {
			reject(new Error('Task timed out'));
		}, 60000); // One minute
		var timer;
		if (inst.type === 'compilation') {
			_socket.on(inst.uuid, function(msg) {
				if (msg === 'online') {
					clearTimeout(timer);
					var obj = {
						compile: inst.options.compile,
						grader: (inst.options.grader !== undefined)
					};
					socket.emit(inst.uuid, obj);
				} else if (msg === 'ready') {
					// Client ready to receive files
					console.log('Task ' + inst.uuid + ': Sending files to judger...');
					var files = [];
					files.push(streamFileAsync(socket, inst.uuid, inst.options.source, inst.options.filename));
					if (inst.options.grader !== undefined)
						files.push(streamFileAsync(socket, inst.uuid, inst.options.grader, inst.options.graderName));
					Promise.all(files).then(function() {
						socket.emit(inst.uuid, 'done');
						timer = setTimeout(function() {
							reject(new Error('Receiver timed out'));
						}, 20000); // 20 seconds
					});
				} else if (typeof(msg) !== 'object') {
					reject(new Error('Receiver rejected the task'));
				} else {
					clearTimeout(timer);
					if (msg.result !== 0) {
						resolve(msg);
					} else {
						ss(_socket).on(inst.uuid + '-file', function(file, filename, resolveClient) {
							receiveFileAsync(file, filename, inst.options.destination).then(function() {
								resolve({
									result: 0,
									file: path.join(inst.options.destination, filename)
								});
							}).then(resolveClient);
						});
					}
				}
			});
		} else {
			_socket.on(inst.uuid, function(msg) {
				clearTimeout(timer);
				if (msg === 'online') {
					socket.emit(inst.uuid, {
						time: inst.options.time,
						memory: inst.options.memory,
						scoreType: inst.options.scoreType,
						inputFile: inst.options.inputFile,
						outputFile: inst.options.outputFile
					});
				} else if (msg === 'ready') {
					console.log('Task ' + inst.uuid + ': Sending files to judger...');
					var files = [
						streamFileAsync(socket, inst.uuid, inst.options.source, 'code'),
						streamFileAsync(socket, inst.uuid, inst.options.input , 'input.txt'),
						streamFileAsync(socket, inst.uuid, inst.options.output, 'output.txt')
					];
					if (inst.options.grader !== undefined) {
						files.push(streamFileAsync(socket, inst.uuid, inst.options.grader, 'grader'));
					}
					Promise.all(files).then(function() {
						socket.emit(inst.uuid, 'done'); // Let's go
						timer = setTimeout(function() {
							reject(new Error('Receiver timed out'));
						}, 20000);
					});
				} else if (typeof(msg) !== 'object') {
					reject(new Error('Receiver rejected the task'));
				} else {
					clearTimeout(timer);
					resolve(msg);
				}
			});
		}
		// Check if the receiver is still connected
		if (socket.adapter.rooms[receiver] === undefined) {
			reject(new Error('Receiver not found'));
		}
		console.log('Task ' + inst.uuid + ' (' + inst.type + ') queued to judge ' + receiver + ' ' + socket.id);
		socket.emit('queue', inst.uuid, inst.type);
		timer = setTimeout(function() { reject(new Error('Receiver timed out')); }, 60000);
	}).then(function(data) {
		console.log('Task ' + inst.uuid + ': Task completed.');
		return data;
	}).finally(function(data) {
		socket.removeAllListeners(inst.uuid);
		socket.removeAllListeners(inst.uuid + '-file');
		return data;
	});
};

/**
 * Send a file and return a promise of the process.
 * This function should not ever reject?
 * @param  {SocketIO.Socket} stream   The socket.io stream.
 * @param  {String} 	     event    Broadcasted event name.
 * @param  {String}  file     The path of the file to send.
 * @param  {String} 		 filename The name of the file. (optional)
 * @return {Promise<>}       The promise of the process
 */
function streamFileAsync(stream, event, file, filename) {
	file = fs.createReadStream(file);
	return new Promise(function(resolve, reject) {
		var goStream = ss.createStream();
		ss(stream).emit(event + '-file', goStream, filename, resolve);
		file.pipe(goStream);
		setTimeout(reject, 10000);
	});
}
/**
 * Receives the file from the stream
 * @param  {ReadableStream} stream  The stream to read from
 * @param  {String}       filename  The name of the file to save
 * @param  {String}          dir	The resulting directory
 * @return {Promise<>}       The promise of the process
 */
function receiveFileAsync(stream, filename, dir) {
	return new Promise(function(resolve, reject) {
		stream.pipe(fs.createWriteStream(path.join(dir, filename)));
		stream.on('end', resolve);
	});
}

module.exports = Task;
