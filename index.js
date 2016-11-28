'use strict';
const electron = require('electron');
const app = electron.app;
const socketServer = require('./socket/server/index');

// Use bluebird as the Promise handler
global.Promise = require('bluebird');

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// prevent window being garbage collected
let mainWindow;
let server;


function onClosed() {
	// dereference the window
	// for multiple windows store them in an array
	mainWindow = null;
}

function createMainWindow() {
	const win = new electron.BrowserWindow({
		width: 960,
		height: 600,
		frame: false,
		resizable: false
	});
	// win.loadURL(`file://${__dirname}/index.html`);
	win.on('closed', onClosed);

	return win;
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
	server.close();
});

app.on('activate', () => {
	if (!mainWindow) {
		mainWindow = createMainWindow();
	}
});

app.on('ready', () => {
	mainWindow = createMainWindow();
	app.mainWindow = mainWindow;
	require('./app/main/index')(app);
	server = require('./server/server');
	socketServer(app, server);
	mainWindow.loadURL('http://127.0.0.1:' + server.running_port + '/admin');
});
