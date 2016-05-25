/**
 * Task promise structure - client side
 */
var ss = require('socket.io-stream');
var fs = require('fs');
var path = require('path');
var stream = require('stream');
var os = require('os');
var temp = Promise.promisifyAll(require('temp')).track();
var sandbox = require('./sandbox/sandbox');
// Implements an asynchronous queue here
//
var Queue = require('promise-queue');
var queue = new Queue(1);
var client;


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
		var f = fs.createWriteStream(path.join(dir, filename));
		stream.pipe(f);
		stream.on('end', function() {
			resolve();
		});
	});
}

/**
 * Converts a string to a ReadableStream
 * @param  {String} string  The string to convert
 * @return {ReadableStream} The resulting stream
 */
function stringToStream(string) {
	var s = new stream.Readable();
	s._read = function noop() {}; // redundant? see update below
	s.push(string);
	s.push(null); return s;
}

/**
 * Executes the compilation task and returns the compiled file
 * @param  {String} uuid The id of the task
 * @return {Promise<>}   The promise of the process
 */
function doCompile(uuid) {
	return temp.mkdirAsync('judger-').then(function(dir) {
		return new Promise(function(resolve, reject) {
			var options;
			var files = [];
			client.emit(uuid, 'online');
			client.on(uuid, function(data) {
				if (typeof(data) === 'object') {
					options = data;
					client.emit(uuid, 'ready');
				}
				else if (data === 'done') {
					Promise.all(files).then(function compile() {
						if (files.length < 1 + (options.grader === true ? 1 : 0))
							reject(new Error('Insufficient file'));
						console.log('Task ' + uuid + ': Compiling file...');
						return new sandbox({
							cmd: options.compile,
							input: null,
							cwd: dir
						}).run();
					}).then(function(result) {
						console.log('Task ' + uuid + ': Compiling ended with exitcode ' + result.exitcode);
						if (result.exitcode === 0) {
							console.log('Task ' + uuid + ': Sending compiled file to server...');
							client.emit(uuid, {result: 0});
							var pathToFile = path.join(dir, 'code');
							if (os.platform === 'win32') pathToFile = path.join(dir, 'code.exe');
							streamFileAsync(client, uuid, pathToFile, 'code')
							.then(resolve);
						} else {
							client.emit(uuid, {result: 1, err: result.stderr});
							resolve();
						}
					});
				}
			});
			ss(client).on(uuid + '-file', function(file, filename, resolve) {
				files.push(receiveFileAsync(file, filename, dir).then(resolve));
			});
		});
	});
}

module.exports = function(ioClient) {
	client = ioClient;
	client.on('queue', function(uuid, type) {
		queue.add(function() {
			if (type === 'compilation') return doCompile(uuid);
		}).then(function() {
			console.log('Task ' + uuid + ': Task completed.');
		});
	});
};
