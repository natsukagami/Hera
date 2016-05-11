var ipcMain = require('electron').ipcMain;

module.exports = function(app) {
	require('./window')(app, ipcMain);
};
