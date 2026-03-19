const { ipcMain } = require("electron");
const vlcFinder = require("../vlcFinder");

function registerOtherHandlers(getMainWindow) {
  ipcMain.handle("get-app-version", () => {
    const { app } = require("electron");
    return app.getVersion();
  });

  ipcMain.handle("find-player", async () => {
    try {
      const mainWindow = getMainWindow();

      console.log("🔍 Автоматический поиск VLC...");
      const vlcPath = await vlcFinder.findVLC();

      if (vlcPath) {
        await vlcFinder.saveToLocalStorage(mainWindow, vlcPath);
        return {
          success: true,
          message: "Найден плеер VLC и установлен как основной",
        };
      } else {
        return {
          success: false,
          message: "Плеер не найден.",
        };
      }
    } catch (err) {
      console.log(`Ошибка поиска плеера: ${err.message}`);
      return {
        success: false,
        message: `Ошибка поиска плеера: ${err.message}`,
      };
    }
  });
}

module.exports = registerOtherHandlers;
