/**
 * Task promise structure - client side
 */
var ss = require('socket.io-stream');
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');
var stream = require('stream');
var os = require('os');
var diff = require('diff');
var cp = Promise.promisifyAll(require('child_process'));
var sandbox = require('./sandbox/sandbox');
var { streamFileAsync, receiveFileAsync, stringToStream } = require('../socket-stream/index');
// Implements an asynchronous queue here
var Queue = require('promise-queue');

module.exports = function(ioClient) {
	client = ioClient;
	var client;
	var temp = Promise.promisifyAll(require('temp')).track();

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
								shell: true
							}).run();
						}).then(function(result) {
							console.log('Task ' + uuid + ': Compiling ended with exitcode ' + result.exitcode);
							if (result.exitcode === 0) {
								console.log('Task ' + uuid + ': Sending compiled file to server...');
								client.emit(uuid, {result: 0});
								var pathToFile = path.join(dir, 'code');
								if (os.platform() === 'win32') pathToFile = path.join(dir, 'code.exe');
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
			fs.removeAsync(dirPath);
		}).finally(function() {
			client.removeAllListeners(uuid);
			client.removeAllListeners(uuid + '-file');
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
		if (os.platform() === 'linux') {
			var cmd = 'diff ' + files[0] + ' ' + files[1];
			if ([0, 2].indexOf(scoreTypes.indexOf(scoreType)) !== -1) cmd += ' -i';
			if (scoreTypes.indexOf(scoreType) < 4) cmd += ' -w';
			console.log('Running diff by command ' + cmd);
			return cp.execAsync(cmd)
					.then(function() {
						return { differ: false };
					})
					.catch(function() {
						return { differ: true };
					});
		}
		return Promise.all(
			files.map(function(file) {
				return fs.readFileAsync(file);
			})
		).then(function prepare() {
			if ([0, 2].indexOf(scoreTypes.indexOf(scoreType)) !== -1) {
				files.forEach(function(str, id, arr) { arr[id] = str.toString().toLowerCase(); });
			} else {
				files.forEach(function(str, id, arr) { arr[id] = str.toString(); });
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
							console.log('Running code in sandbox...');
							return new sandbox({
								cmd: 'code' + (os.platform() === 'win32' ? '.exe' : ''),
								input: options.inputFile,
								output: options.outputFile,
								cwd: dir,
								time: options.time,
								memory: options.memory
							}).run().then(function(data) {
								// File error, most of
								if (options.outputFile === 'stdout') return data;
								if (data.exitcode !== 0) return data;
								return fs.statAsync(path.join(dir, options.outputFile))
										.then(function() {
											return data;
										})
										.catch(function(err) {
											return {
												exitcode: -1,
												signal: 'FF',
												time: 0,
												memory: 0
											};
										});
							});
						}).then(function evaluate(result) {
							if (result.exitcode !== 0) {
								var judgeReturns = '';
								if (result.signal === 'RTE') judgeReturns = 'Chạy sinh lỗi, chương trình thoát với exitcode ' + result.exitcode;
								else if (result.signal === 'TLE') judgeReturns = 'Chạy quá thời gian';
								else if (result.signal === 'FF') judgeReturns = 'Không thấy file kết quả';
								else if (result.signal === '??') judgeReturns = 'Trình chấm bị lỗi';
								return {
									result: result.signal,
									score: 0,
									judgeReturns: judgeReturns,
									time: result.time,
									memory: result.memory
								};
							} else {
								var files = [path.join(dir, 'output.txt')];
								var ops = [];
								if (options.outputFile === 'stdout') {
									files.push(path.join(dir, '_output.txt'));
									ops.push(fs.writeFileAsync(path.join(dir, '_output.txt'), result.stdout));
								} else {
									files.push(path.join(dir, options.outputFile));
								}
								return Promise.all(ops).then(function() {
									if (scoreTypes.indexOf(options.scoreType) < 5 || true)
										return runDiff(files, options.scoreType);
								}).then(function(diff) {
									console.log({
										result: (diff.differ ? 'WA' : 'AC'),
										judgeReturns: (diff.differ ? 'Kết quả KHÁC đáp án' : 'Kết quả đúng đáp án!'),
										score: (diff.differ ? 0 : 1),
										time: result.time,
										memory: result.memory
									});
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
						}).catch(function(err) {
							console.log(err);
						});
					}
				});
				ss(client).on(uuid + '-file', function(file, filename, resolveServer) {
					files[filename] = true;
					if (os.platform() === 'win32' && /^(code|scorer)$/.test(filename))
						filename = filename + '.exe';
					filelist.push(receiveFileAsync(file, filename, dir)
					.then(function() {
						resolveServer();
						return path.join(dir, filename);
					}));
				});
			});
		})
		.catch(function(err) {
			console.log(err);
		})
		.finally(function() {
			client.removeAllListeners(uuid);
			client.removeAllListeners(uuid + '-file');
			fs.removeAsync(dirPath);
		});
	}
	var queue = new Queue(1);
	client.on('queue', function(uuid, type) {
		queue.add(function() {
			console.log(client.io.engine.id + ': Accepting task ' + uuid + ' (' + type + ')...');
			if (type === 'compilation') return doCompile(uuid);
			if (type === 'evaluation') return doEvaluate(uuid);
			throw new Error('Undetermined request');
		}).then(function() {
			console.log('Task ' + uuid + ': Task completed.');
		}).catch(function(err) {
			console.log(err);
			queue.queue = []; // So that no new error would be made
			client.io.reconnect();
		});
	});
	client.on('disconnect', function() {
		console.log('Client disconnected');
		queue.queue = []; // So that no new error would be made
		client.io.reconnect();
	});
};
