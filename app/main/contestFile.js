var dialog = Promise.promisifyAll(require('electron').dialog);
var fs = Promise.promisifyAll(require('fs'));
console.log(Promise.promisifyAll);
var jszip = require('jszip');
jszip.external.Promise = GLOBAL.Promise = require('bluebird');
var temp = Promise.promisifyAll(require('temp')).track();
var path = require('path');
var zlib = Promise.promisifyAll(require('zlib'));
var xml2js = Promise.promisifyAll(require('xml2js'));

var webContents;

// Contest File logic

/**
 * Parses an XML file, deflated with zlib into a JSON object
 * @param  {Buffer} file 		The input file buffer
 * @return {Promise<Object>}	The output JSON object
 */
function zlibToXml(file) {
	return zlib	.inflateAsync(file)
				.then(function(buf) {
					// Convert buffer to string
					buf = buf.toString();
					return buf;
				})
				.then(function(str) {
					// Convert XML string to JSON object
					return xml2js.parseStringAsync(str);
				})
				.catch(function(err) {
					// Handle any error
					dialog.showErrorBoxAsync(
						'Lỗi',
						'Không thể dịch file kết quả và các file cấu hình. Phải chăng file .contest bị lỗi?'
					);
					console.log(err);
					return err;
				});
}

/**
 * Parse contest result (Contest.result file) into Hera-readable JS object
 * @param  {Object} results The Contest.result file, decoded
 * @return {Object}         Hera-readable Contest object
 */
function parseContestResult(results) {
	var ret = {
		'students': [],
		'problems': []
	};
	results.ContestResult.ContestantResult.forEach(function(studentResult) {
		var student = {
			name: studentResult.$.ContestantName,
			total: Number(studentResult.$.Evaluation),
			problems: {}
		};
		studentResult.ExamResult.forEach(function(examResult) {
			if (ret.problems.indexOf(examResult.$.ExamName) === -1) {
				// New problem?
				ret.problems.push(examResult.$.ExamName);
			}
			var pName = examResult.$.ExamName;
			if (examResult.$.State === '2') {
				// Compile Error
				student.problems[pName] = 'CE';
			} else if (examResult.$.State === '1') {
				// Compile Successful, with score
				student.problems[pName] = {
					score: Number(examResult.$.Evaluation),
					details: {}
				};
				examResult.TestResult.forEach(function(testResult) {
					var tests = student.problems[pName].details;
					tests[testResult.$.TestName] = {
						score: Number(testResult.$.Evaluation),
						result: testResult.$.EvaluationText
					};
					if (testResult.$.RunningTime !== undefined) {
						tests[testResult.$.TestName].time = Number(testResult.$.RunningTime);
					}
					if (testResult.$.MemoryUsed !== undefined) {
						tests[testResult.$.TestName].memory = Number(testResult.$.MemoryUsed);
					}
				});
			}
		});
		ret.students.push(student);
	});
	return ret;
}

/**
 * Does the unpacking of the *.contest file
 * into a temporary folder.
 * @param  {ElectronApp} 	app         [description]
 * @param  {string} 		contestFile [description]
 * @return {Promise<>}      [description]
 */
function unpackContest(app, contestFile) {
	// Send an alert to change the loading bar
	webContents.send('judge-bar', {
		status: 'Đang giải nén file ' + contestFile + '...',
		value: ['set', 0],
		maxValue: ['set', 1],
		mode: 'determinate'
	});
	return temp.mkdirAsync('contest-').then(function(dir) {
		return fs	.readFileAsync(contestFile)
					.then(function(data) {
						return data;
					})
					.then(function(data) {
						// Read the content with jszip
						var contest = new jszip();
						return contest.loadAsync(data, { createFolders: true});
					})
					.then(function(contest) {
						// Unpack it to the desired temp folder
						contest.forEach(function(relPath, file) {
							if (file.dir) {
								// Create the folders first
								fs.mkdirSync(path.join(dir, relPath));
							}
						});
						var promises = [];
						contest.forEach(function(relPath, file) {
							if (file.dir) return;
							// Update the progress bar
							webContents.send('judge-bar', {
								maxValue: ['add', 1]
							});
							// Write the file down
							promises.push(file.async('nodebuffer').then(function(data) {
								return fs.writeFileAsync(path.join(dir, relPath), data);
							}).then(function() {
								console.log('Written ' + relPath);
								webContents.send('judge-bar', {
									value: ['add', 1]
								});
							}));
						});
						return Promise.all(promises);
					})
					.then(function() {
						// Decode the data files
						return fs.readFileAsync(path.join(dir, 'Contest.result'))
							.then(function(file) {
								return zlibToXml(file);
							})
							.then(function(object) {
								app.currentContest = parseContestResult(object);
								return app.currentContest;
							})
							.catch(function(err) {
								dialog.showErrorBoxAsync(
									'Lỗi',
									'Không thể mở file: ' + err.toString()
								);
								return err;
							});
					})
					.then(function(contestData) {
						// Send contest data to renderer
						webContents.send('reload-table', contestData);
					})
					.catch(function(err) {
						dialog.showErrorBoxAsync(
							'Lỗi',
							'Không thể mở file'
						).then(function() {
							app.quit();
						});
					});
	}).error(function(err) {
		dialog.showErrorBoxAsync(
			'Out of memory',
			'Your temp folder has ran out of memory. Hera will now quit.'
		).then(function() {
			app.quit();
		});
	});
}

module.exports = function(app, ipc) {
	webContents = app.mainWindow.webContents;
	ipc.on('file-open-contest', function() {
		dialog.showOpenDialogAsync({
			title: 'Mở kì thi cũ',
			defaultPath: __dirname,
			filters: [
				{ name: 'Themis/Hera Contest', extensions: ['contest'] }
			],
			properties: ['openFile']
		}).catch(function(filepath) {
			// Since the electron function does not call func(err, res), we use
			// .catch instead of .then to get the first argument
			console.log('Opening ' + filepath[0]);
			unpackContest(app, filepath[0]).then(function() {
				console.log('Unpacking Done');
				webContents.send('judge-bar', {
					status: 'Mở file thành công',
					value: ['add', 1]
				});
				setTimeout(function() { webContents.send('judge-bar', 'reset'); }, 3000);
			});
		});
	});
};
