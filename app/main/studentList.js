var { dialog } = require('electron');
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');
var webContents;
var app;

var addStudents = function(dirpath) {
	// User cancelled the call
	if (dirpath === undefined) return;
	dirpath = dirpath[0];
	fs	.readdirAsync(dirpath)
		.then(function(list) {
			// For each item in foler, check if it's a directory
			return Promise.all(list.map(function(item) {
				return fs.lstatAsync(path.join(dirpath, item))
						.then(function(stat) { return [item, stat.isDirectory()]; });
			}));
		})
		.then(function(list) {
			// Clear the folders and database first
			app.currentContest.students = {};
			app.currentContest.saved = false;
			return fs.emptyDirAsync(path.join(app.currentContest.dir, 'Contestants')).then(function() { return list; });
		})
		.then(function(list) {
			// Add and copy the folders to tmp
			return Promise.all(list.map(function(item) {
				if (item[1] === true) {
					// Is a directory
					return fs.copyAsync(path.join(dirpath, item[0]), path.join(app.currentContest.dir, 'Contestants', item[0]), {
						clobber: true,
						dereference: true
					}).then(function() {
						console.log('Student ' + item[0] + ' added');
						app.currentContest.students[item[0]] = {
							name: item[0],
							total: 0,
							problems: {}
						};
					});
				}
				return null;
			}));
		})
		.then(function() {
			app.sendContestToRenderer(app.currentContest);
		})
		.error(function(err) {
			dialog.showErrorBox(
				'Lỗi',
				'Không thể mở thư mục ' + path + ': ' + err
			);
		});
};

module.exports = function(electronApp, ipc) {
	app = electronApp;
	webContents = app.mainWindow.webContents;
	ipc.on('add-student', function() {
		dialog.showOpenDialog({
			title: 'Nạp danh sách thí sinh',
			properties: ['openDirectory']
		}, addStudents);
	});
	ipc.on('delete-student', function(event, value) {
		delete app.currentContest.students[value.student];
		app.sendContestToRenderer(app.currentContest);
	});
};
