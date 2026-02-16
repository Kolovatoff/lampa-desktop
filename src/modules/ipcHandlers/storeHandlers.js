const { ipcMain } = require("electron");

function registerStoreHandlers(store) {
  // Обработчик изменения URL
  const { getMainWindow } = require("../windowManager");

  store.onDidChange("lampaUrl", (newValue) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.loadURL(newValue);
    }
  });

  ipcMain.handle("store-get", (event, key) => {
    return store.get(key);
  });

  ipcMain.handle("store-set", (event, key, value) => {
    store.set(key, value);
  });

  ipcMain.handle("store-has", (event, key) => {
    return store.has(key);
  });

  ipcMain.handle("store-delete", (event, key) => {
    if (store.has(key)) {
      store.delete(key);
      return true;
    }
    return false;
  });
}

module.exports = registerStoreHandlers;
