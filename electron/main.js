// electron/main.js
import pkg from 'electron'
import path from "node:path"
// import isDev from 'electron-is-dev';
import { spawn } from 'node:child_process';

const { app, BrowserWindow, ipcMain, Menu } = pkg

let backendProcess;
let mainWindow;
const executablePath = process.execPath;
const __dirname = path.dirname(executablePath);
console.log(__dirname)

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1680,
        height: 1060,
        autoHideMenuBar: true,
        webPreferences: {
            // preload: path.join(__dirname, '../../../electron/preload.js'),
            nodeIntegration: true, // If your React app needs Node.js access (be cautious)
            contextIsolation: false,
        },
    });

    // Load your React app's index.html (you might need to adjust the path)
    // Load the React app

    mainWindow.loadURL("http://localhost:3001");
    mainWindow.webContents.openDevTools();

    Menu.setApplicationMenu(null);

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Kill the backend process when the main window is closed
        if (backendProcess) {
            backendProcess.kill();
        }
    });
}

ipcMain.on('app-close', () => {
    mainWindow.close();
});

app.on('ready', () => {
    // Path to your .exe file
    let backendExePath;

    // if (!isDev) {
    //     backendExePath = `cd ../../../ | npm run server`

    // }
    // else {
    //     backendExePath = path.join(__dirname, '../../../app/server.exe');
    // }
    console.log(path.join(__dirname, '../../../app/server.exe'))
    backendExePath = path.join(__dirname, '../../../app/server.exe');



    // Launch the .exe file as a child process
    backendProcess = spawn(backendExePath);

    // Optional: Log output from the backend process
    backendProcess.stdout.on('data', (data) => {
        console.log(`Backend Output: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`Backend Error: ${data}`);
    });

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();

    }
});