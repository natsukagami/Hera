var { dialog } = require('electron');
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');
var webContents;
var contest;

module.exports = function(app, ipc) {
	webContents = app.mainWindow.webContents;
	app.startupPromise.then(function() {
		contest = app.currentContest;
	});
	ipc.on('add-student', function() {
		dialog.showOpenDialog({
			title: 'Nạp danh sách thí sinh',
			properties: ['openDirectory']
		}, function(dirpath) {
			// User cancelled the call
			if (dirpath === undefined) return;
			dirpath = dirpath[0];
			contest.students = {};
			fs	.readdirAsync(dirpath)
				.then(function(list) {
					// For each item in foler, check if it's a directory
					return Promise.all(list.map(function(item) {
						return fs.lstatAsync(path.join(dirpath, item))
								.then(function(stat) { return [item, stat.isDirectory()]; });
					}));
				})
				.then(function(list) {
					return Promise.all(list.map(function(item) {
						if (item[1] === true) {
							// Is a directory
							return fs.copyAsync(path.join(dirpath, item[0]), path.join(contest.dir, 'Contestants0', item[0]), {
								clobber: true,
								dereference: true
							}).then(function() {
								console.log('Student ' + item[0] + ' added');
								contest.students[item[0]] = {
									name: item[0],
									total: 0,
									details: []
								};
							});
						}
						return null;
					}));
				})
				.then(function() {
					app.sendContestToRenderer(contest);
				})
				.error(function(err) {
					dialog.showErrorBox(
						'Lỗi',
						'Không thể mở thư mục ' + path + ': ' + err
					);
				});
		});
	});
	ipc.on('delete-student', function(event, value) {
		delete contest.students[value.student];
		app.sendContestToRenderer(contest);
	});
};
