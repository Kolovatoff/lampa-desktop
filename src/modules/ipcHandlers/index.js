// modules/ipcHandlers/index.js
const store = require("../storeManager");
const { getMainWindow } = require("../windowManager");
const { injectPlugin } = require("../pluginHandler");

const registerStoreHandlers = require("./storeHandlers");
const registerProcessHandlers = require("./processHandlers");
const registerWindowHandlers = require("./windowHandlers");
const { registerSettingsHandlers } = require("./settingsHandlers");
const registerCloudHandlers = require("./cloudHandlers");
const registerTorrServerHandlers = require("./torrServerHandlers");
const registerFolderHandlers = require("./folderHandlers");
const registerOtherHandlers = require("./otherHandlers");

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

  // Обработчики для работы с папками
  registerFolderHandlers();

  // Дополнительные обработчики
  registerOtherHandlers(getMainWindow);
}

module.exports = {
  registerIpcHandlers,
};
