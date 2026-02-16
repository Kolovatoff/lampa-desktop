const { ipcMain } = require("electron");

function registerWindowHandlers(getMainWindow) {
  ipcMain.on("toggle-fullscreen", () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.setFullScreen(true);
    }
  });

  ipcMain.on("reload-page", (event, url) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    mainWindow.loadURL(url).catch((err) => {
      console.error("Ошибка загрузки URL:", err);
    });
  });

  ipcMain.on("close-app", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.close();
    }
  });
}

module.exports = registerWindowHandlers;
