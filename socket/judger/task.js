/**
 * Task promise structure - client side
 */
var ss = require('socket.io-stream');
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');
var stream = require('stream');
var os = require('os');
var diff = require('diff');
var temp = Promise.promisifyAll(require('temp')).track();
var sandbox = require('./sandbox/sandbox');
// Implements an asynchronous queue here
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
	var dirPath;
	return temp.mkdirAsync('judger-').then(function(dir) {
		dirPath = dir;
		return new Promise(function(resolve, reject) {
			var options;
			var files = [];
			client.emit(uuid, 'online');
			var timer = setTimeout(function() {
				reject(new Error('Server timed out'));
			}, 10000);
			client.on(uuid, function(data) {
				clearTimeout(timer);
				if (typeof(data) === 'object') {
					options = data;
					client.emit(uuid, 'ready');
				}
				else if (data === 'done') {
					Promise.all(files).then(function compile() {
						if (files.length < 1 + (options.grader === true ? 1 : 0))
							return reject(new Error('Insufficient file'));
						console.log('Task ' + uuid + ': Compiling file...');
						return new sandbox({
							cmd: options.compile,
							input: null,
							output: 'stdout',
							cwd: dir,
							time: 10,
							shell: true
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
							client.emit(uuid, {result: 1, err: result.err});
							resolve();
						}
					});
				}
			});
			ss(client).on(uuid + '-file', function(file, filename, resolve) {
				files.push(receiveFileAsync(file, filename, dir).then(resolve));
			});
		});
	}).then(function() {
		client.removeAllListeners(uuid);
		client.removeAllListeners(uuid + '-file');
		return fs.removeAsync(dirPath);
	});
}

var scoreTypes = [
	'C1LinesWordsIgnoreCase.dll',
	'C2LinesWordsCase.dll',
	'C3WordsIgnoreCase.dll',
	'C4WordsCase.dll',
	'C5Binary.dll',
	'C6AMM2External.dll',
	'C7External.dll',
	'C8CompileThemis.dll',
	'C9CompileTestlib.dll',
	'C10CompileCMS.dll',
	'C11GraderDiff.dll'
];

/**
 * Runs the diff tool and return the changes
 * @param  {[String]} files   The files to compare
 * @param  {String} scoreType The diff type (as defined above)
 * @return {Promise<{bool, Array<String>}>}  The diff object
 */
function runDiff(files, scoreType) {
	return Promise.all([

	]).then(function prepare() {
		if ([0, 2].indexOf(scoreTypes.indexOf(scoreType)) !== -1) {
			files.forEach(function(str, id, arr) { arr[id] = str.toString().toLowerCase(); });
		}
		return files;
	}).then(function compare(files) {
		switch (scoreTypes.indexOf(scoreType)) {
		case 0:
		case 1:
			return diff.diffTrimmedLines(files[0], files[1]);
		case 2:
		case 3:
			return diff.diffWords(files[0], files[1]);
		case 4:
			return diff.diffChars(files[0], files[1]);
		default:
			throw new Error('Wrong score type');
		}
	}).then(function format(Diff) {
		var differ = false;
		Diff.forEach(function(item) { differ = differ || (item.added === true || item.removed === true); });
		return {
			differ: differ,
			details: Diff
		};
	});
}

/**
 * Executes the evaluation task and returns the compiled informations
 * @param  {String} uuid The id of the task
 * @return {Promise<>}   The promise of the process
 */
function doEvaluate(uuid) {
	var dirPath;
	return temp.mkdirAsync('judger-').then(function(dir) {
		dirPath = dir;
		return new Promise(function(resolve, reject) {
			var timer;
			client.emit(uuid, 'online');
			timer = setTimeout(function() {
				reject(new Error('Server timed out'));
			}, 10000);
			var options, files = {}, filelist = [];
			client.on(uuid, function(data) {
				clearTimeout(timer);
				if (typeof(data) === 'object') {
					options = data;
					client.emit(uuid, 'ready');
				} else if (data === 'done') {
					Promise.all(filelist).
					then(function check(list) {
						if (!files['code'] || !files['input.txt'] || !files['output.txt'])
							reject(new Error('Insufficient file'));
						if (scoreTypes.indexOf(options.scoreType) >= 5 && !files['scorer'])
							reject(new Error('Insufficient file'));
					}).then(function execute() {
						return new sandbox({
							cmd: 'code' + (os.platform === 'win32' ? '.exe' : ''),
							input: options.inputFile,
							output: options.outputFile,
							cwd: dir,
							time: options.time,
							memory: options.memory
						}).run();
					}).then(function evaluate(result) {
						console.log('Task ' + uuid + ': Process terminated with exitcode ' + result.exitcode);
						if (result.exitcode !== 0) {
							return {
								result: result.signal,
								score: 0,
								time: result.time,
								memory: result.memory
							};
						} else {
							var files = [fs.readFileAsync(path.join(dir, 'output.txt'))];
							if (options.outputFile !== 'stdout')
								files.push(fs.readFileAsync(path.join(dir, options.outputFile)));
							return Promise.all(files).then(function(content) {
								files = [content[0], (options.outputFile === 'stdout' ? result.stdout : content[1])];
								if (scoreTypes.indexOf(options.scoreType) < 5 || true)
									return runDiff(files, options.scoreType);
							}).then(function(diff) {
								return {
									result: (diff.differ ? 'WA' : 'AC'),
									judgeReturns: (diff.differ ? 'Kết quả KHÁC đáp án' : 'Kết quả đúng đáp án!'),
									score: (diff.differ ? 0 : 1),
									time: result.time,
									memory: result.memory
								};
							});
						}
					}).then(function send(result) {
						client.emit(uuid, result);
						resolve();
					});
				}
			});
			ss(client).on(uuid + '-file', function(file, filename, resolveServer) {
				files[filename] = true;
				if (os.platform === 'win32' && /^(code|scorer)$/.test(filename))
					filename = filename + '.exe';
				filelist.push(receiveFileAsync(file, filename, dir)
				.then(function() {
					resolveServer();
					return path.join(dir, filename);
				}));
			});
		});
	}).finally(function() {
		client.removeAllListeners(uuid);
		client.removeAllListeners(uuid + '-file');
		return fs.removeAsync(dirPath);
	});
}

module.exports = function(ioClient) {
	client = ioClient;
	client.on('queue', function(uuid, type) {
		queue.add(function() {
			console.log('Accepting task ' + uuid + ' (' + type + ')...');
			if (type === 'compilation') return doCompile(uuid);
			if (type === 'evaluation') return doEvaluate(uuid);
			throw new Error('Undetermined request');
		}).then(function() {
			console.log('Task ' + uuid + ': Task completed.');
		});
	});
};
