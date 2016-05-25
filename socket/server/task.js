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
var io;

/**
 * The task object
 * @param  {String} type    The task type. Can be either 'compilation' or 'evaluation'
 * @param  {Object} options Task options.
 *     - For 'compilation' tasks, the option should provide
 *      + @param {String}		  filename The file name
 *     	+ @param {String}         source   The path of the source code
 *     	+ @param {String}       graderName The name of the grader file, if required [optional]
 *     	+ @param {String}         grader   The path code for the grader, if required [optional]
 *     	+ @param {String}		  compile  The command for compilation
 *     	+ @param {String}      destination The directory to save the compiled binary
 *     - For 'evaluation' tasks, the option should provide
 *      + @param {String}          source  The path of the binary executable file
 *      + @param {String}          input   The path of the input file
 *      + @param {String}          output  The path of the expected output file
 *      + @param {String}      scoreType  The scoring method
 *      + @param {String}          scorer  The path of the binary executable scorer [optional]
 * @return {Promise<Object>} The task result
 *     - For 'compilation' tasks, the object should provide
 *      + @param {Int}            result  The compilation result (0 for success, 1 for error)
 *      + @param {String} 		  file    In case of success, path of the compiled binary file
 *      + @param {String}		  err     In case of failure, a string containing the error
 *     - For 'evaluation' tasks, the object should provide
 *      + @param {string}         result  The judging result (AC, WA, TLE, MLE, RTE, PS) (PS = Partially scored)
 *      + @param {string}    judgeRetuns  Any additional output of the scorer [optional]
 *      + @param {Number}		  score   The score of the test (between 0 and 1)
 *      + @param {Number}		  time    The running time of the code (in seconds)
 *      + @param {Number}		  memory  The used memory of the code (in kB)
 *   * If the task did not end in time, an error will be emitted
 */
var Task = function(type, options) {
	var inst = this;
	/**
	 * send the task to a client, receiving results from it or cancel after a timeout
	 * @param  {String} receiver Id of the receiver (as a socket.io client)
	 * @return {Promise<Object>} A promise of type above
	 */
	this.send = function(receiver, socket) {
		inst.uuid = uuid.v4(); // Give the task a random id
		return new Promise(function(resolve, reject) {
			var timer;
			if (type === 'compilation') {
				socket.on(inst.uuid, function(msg) {
					if (msg === 'online') {
						var obj = {
							compile: options.compile,
							grader: (options.grader !== undefined)
						};
						socket.emit(inst.uuid, obj);
					} else if (msg === 'ready') {
						// Client ready to receive files
						console.log('Task ' + inst.uuid + ': Sending file to judger...');
						var files = [];
						files.push(streamFileAsync(socket, inst.uuid, options.source, options.filename));
						if (options.grader !== undefined)
							files.push(streamFileAsync(socket, inst.uuid, options.grader, options.graderName));
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
						if (msg.result === 1) {
							resolve(msg);
						} else {
							ss(socket).on(inst.uuid + '-file', function(file, filename, resolveClient) {
								receiveFileAsync(file, filename, options.destination).then(function() {
									resolve({
										result: 0,
										file: path.join(options.destination, filename)
									});
								}).then(resolveClient);
							});
						}
					}
				});
			}
			// Check if the receiver is still connected
			if (socket.adapter.rooms[receiver] === undefined) {
				reject(new Error('Receiver not found'));
			}
			console.log('Task ' + inst.uuid + ' queued to judge ' + receiver);
			socket.emit('queue', inst.uuid, type);
		}).then(function(data) {
			console.log('Task ' + inst.uuid + ': Task completed.');
			return data;
		});
	};
};

/**
 * Send a file and return a promise of the process.
 * This function should not ever reject?
 * @param  {SocketIO.Socket} stream   The socket.io stream.
 * @param  {String} 	     event    Broadcasted event name.
 * @param  {ReadableStream}  file     The file to send.
 * @param  {String} 		 filename The name of the file. (optional)
 * @return {Promise<>}       The promise of the process
 */
function streamFileAsync(stream, event, file, filename) {
	file = fs.createReadStream(file);
	return new Promise(function(resolve, reject) {
		var goStream = ss.createStream();
		ss(stream).emit(event + '-file', goStream, filename, resolve);
		file.pipe(goStream);
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

module.exports = function(socket) {
	io = socket;
	return Task;
};
