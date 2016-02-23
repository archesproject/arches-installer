const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

var mainWindow = null;
var env = 'development';
process.argv.forEach(function (val, index, array) {
    var argvItem = val.split('=');
    if (argvItem[0]==='--env') {
        env = argvItem[1];
    }
});

app.getEnvName = function () {
    return env;
};

app.on('window-all-closed', function() {
    app.quit();
});

app.on('ready', function() {
    var dev = (app.getEnvName() === 'development');
    mainWindow = new BrowserWindow({width: (dev?1900:1100), height: 850});
    mainWindow.loadURL('file://' + __dirname + '/index.html');

    if(dev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', function() {
        mainWindow = null;
    });
});
