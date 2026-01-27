const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const { existsSync } = require('fs');
const { spawn } = require('child_process');
const which = require('which');
const { updateElectronApp, UpdateSourceType} = require('update-electron-app');

if (require('electron-squirrel-startup')) {
  app.quit();
}

let proxyProcess;
function startProxy() {
  proxyProcess = spawn("node", [path.join(__dirname, "proxy.js")]);
  proxyProcess.stdout.on("data", (data) => {
    console.log(`Proxy: ${data}`);
  });
  proxyProcess.stderr.on("data", (data) => {
    console.error(`Proxy Error: ${data}`);
  });
}

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'img', 'og.png'),
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webSecurity: true
  });

  mainWindow.setMenu(null)
  mainWindow.loadURL('http://lampa.mx');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    if (process.platform === 'darwin') {
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  // открываем консоль
  // mainWindow.webContents.openDevTools();
};

// IPC обработчик для fs-existsSync
ipcMain.on('fs-existsSync', async (event, filePath) => {
  try {
    const resolvedPath = await which(filePath, {path: process.env.PATH});
    event.returnValue = existsSync(resolvedPath);
  } catch (err) {
    event.returnValue = false;
  }
});

// IPC обработчик для child-process-spawn
ipcMain.on('child-process-spawn', async (event, id, cmd, args, opts) => {
  try {
    const resolvedCmd = await which(cmd, {path: opts?.env?.PATH || process.env.PATH});
    const spawnOptions = opts || {};
    spawnOptions.env = {...process.env, ...(opts?.env || {})};
    const child = spawn(resolvedCmd, args, spawnOptions);
    child.on('error', (err) => {
      event.sender.send(`child-process-spawn-error-${id}`, err);
    });
    child.on('exit', (code) => {
      event.sender.send(`child-process-spawn-exit-${id}`, code);
    });
    child.stdout.on('data', (data) => {
      event.sender.send(`child-process-spawn-stdout-${id}`, data);
    });
    child.stderr.on('data', (data) => {
      event.sender.send(`child-process-spawn-stderr-${id}`, data);
    });
  } catch (err) {
    event.sender.send(`child-process-spawn-error-${id}`, new Error(`Command ${cmd} not found: ${err.message}`));
  }
});

app.whenReady().then(async () => {
  startProxy(); // Start proxy on app launch
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  try {
    updateElectronApp({
        updateSource: {
            type: UpdateSourceType.ElectronPublicUpdateService,
            repo: 'Kolovatoff/lampa-desktop'
        },
        updateInterval: '1 hour',
        logger: require('electron-log')
    });
  } catch (error) {
    console.error('Ошибка при настройке автообновлений:', error);
  }

});

app.on('window-all-closed', () => {
  // stop proxy on app exit
  if (proxyProcess) proxyProcess.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// process.on('uncaughtException', (error) => {
//   log.error('Необработанная ошибка:', error);
// });
//
// process.on('unhandledRejection', (reason, promise) => {
//   log.error('Необработанное отклонение промиса:', promise, 'причина:', reason);
// });
