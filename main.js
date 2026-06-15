const {app, BrowserWindow, session} = require('electron');
const remote = require('@electron/remote/main');

remote.initialize(); // remote module

function createWindow() {
    // handle permissions
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true); // grant permission for mic access 
        } else {
            callback(false);
        }
    });

    // creating the app window
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    remote.enable(win.webContents);

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);