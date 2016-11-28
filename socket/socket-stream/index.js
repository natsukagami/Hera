var fs = require('fs');
var stream = require('stream');
var path = require('path');
var ss = require('socket.io-stream');

/**
 * Receives the file from the stream
 * @param  {ReadableStream} stream  The stream to read from
 * @param  {String}       filename  The name of the file to save
 * @param  {String}          dir	The resulting directory
 * @return {Promise<>}       The promise of the process
 */
function receiveFileAsync(stream, filename, dir) {
	console.log('Receiving file ' + filename + '...');
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

module.exports = {
	streamFileAsync: streamFileAsync,
	receiveFileAsync: receiveFileAsync,
	stringToStream: stringToStream
};
