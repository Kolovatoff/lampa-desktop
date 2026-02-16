const { app } = require("electron");

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

function setupAppLifecycle() {
  app.on("second-instance", () => {
    const { getMainWindow } = require("./windowManager");
    const mainWindow = getMainWindow();

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

module.exports = {
  setupAppLifecycle,
  gotTheLock,
};
