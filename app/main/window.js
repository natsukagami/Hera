module.exports = function(app, ipc) {
	ipc.on('close-main-window', function() {
		app.quit();
	});
};
