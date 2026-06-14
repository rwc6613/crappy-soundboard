const {app, BrowserWindow, session} = require('electron');

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

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);