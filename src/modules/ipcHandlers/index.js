// modules/ipcHandlers/index.js
const { ipcMain } = require("electron");
const store = require("../storeManager");
const { getMainWindow } = require("../windowManager");
const { injectPlugin } = require("../pluginHandler");

// Импорт обработчиков
const registerStoreHandlers = require("./storeHandlers");
const registerProcessHandlers = require("./processHandlers");
const registerWindowHandlers = require("./windowHandlers");
const { registerSettingsHandlers } = require("./settingsHandlers");
const registerCloudHandlers = require("./cloudHandlers");
const registerTorrServerHandlers = require("./torrServerHandlers");

function registerIpcHandlers() {
  // Базовые обработчики store
  registerStoreHandlers(store);

  // Обработчики для процессов (spawn, fs)
  registerProcessHandlers();

  // Обработчики для управления окном
  registerWindowHandlers(getMainWindow);

  // Обработчики для экспорта/импорта настроек
  registerSettingsHandlers(store, getMainWindow, injectPlugin);

  // Обработчики для облачного экспорта/импорта
  registerCloudHandlers(store, getMainWindow, injectPlugin);

  // Обработчики для TorrServer
  registerTorrServerHandlers();

  // Дополнительные обработчики
  ipcMain.handle("get-app-version", () => {
    const { app } = require("electron");
    return app.getVersion();
  });
}

module.exports = {
  registerIpcHandlers,
};
