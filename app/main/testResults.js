var webContents = null;
var dialog = Promise.promisifyAll(require('electron').dialog);

module.exports = function(app, ipc) {
	webContents = app.mainWindow.webContents;
	ipc.on('result-drawer', function(event, data) {
		if (app.currentContest.students[data.student] === undefined) {
			dialog.showMessageBoxAsync({
				type: 'info',
				title: 'Không có thí sinh',
				message: 'Thí sinh không tồn tại',
				buttons: ['OK']
			});
			return;
		}
		var student = app.currentContest.students[data.student];
		if (student.problems[data.problem] === undefined) {
			dialog.showMessageBoxAsync({
				type: 'info',
				title: 'Không có bài',
				message: 'Thí sinh không nộp bài này',
				buttons: ['OK']
			});
			return;
		}
		if (student.problems[data.problem] === 'CE') {
			dialog.showMessageBoxAsync({
				type: 'info',
				title: 'Dịch lỗi',
				message: 'Thí sinh nộp bài dịch lỗi',
				buttons: ['OK']
			});
			return;
		}
		webContents.send('result-drawer', student.problems[data.problem].details);
	});
	ipc.on('rejudge', function(event, data) {
		console.log('rejudge on ' + data.student + ' ' + data.problem);
		app.enqueue([
			{
				student: app.currentContest.students[data.student],
				problem: app.currentContest.problems[data.problem]
			}
		]);
	});
	var selectedRows = [];
	ipc.on('update-selected', function(event, selected) {
		if (selected === 'all') {
			selectedRows = Object.keys(app.currentContest.students).map(function(id) {
				return app.currentContest.students[id];
			});
		} else selectedRows = selected.map(function(id) {
			return app.currentContest.students[id];
		});
	});
	ipc.on('system-rejudge-selected', function(event) {
		var queue = [];
		selectedRows.forEach(function(student) {
			Object.keys(app.currentContest.problems).forEach(function(id) {
				queue.push({
					student: student,
					problem: app.currentContest.problems[id]
				});
			});
		});
		app.enqueue(queue);
	});
};
