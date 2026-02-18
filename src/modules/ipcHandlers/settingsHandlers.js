const { ipcMain, dialog } = require("electron");
const { readFileSync, writeFileSync } = require("fs");

// Экспортируем функцию для использования в других модулях
async function importSettings(settings, store, mainWindow, injectPlugin) {
  const currentUrlBefore = store.get("lampaUrl");

  if (settings.app) {
    for (const [key, value] of Object.entries(settings.app)) {
      if (store.has(key)) {
        store.set(key, value);
      }
    }
  }

  if (settings.lampa) {
    if (settings.lampa.plugins) {
      try {
        const pluginsArray = JSON.parse(settings.lampa.plugins);
        const filteredPlugins = pluginsArray.filter((plugin) => {
          const cleanUrl = plugin.url
            .replace(/^https?:\/\//, "")
            .replace(/^\/\//, "");
          return cleanUrl !== "lampa.kolovatoff.ru/ei.js";
        });
        settings.lampa.plugins = JSON.stringify(filteredPlugins, null, 2);
      } catch (e) {
        console.warn('Ошибка при обработке поля "plugins":', e);
      }
    }

    await mainWindow.webContents.executeJavaScript(`
      localStorage.clear();
      Lampa.Cache.clearAll();

      Object.entries(${JSON.stringify(settings.lampa)}).forEach(([key, value]) => {
          localStorage.setItem(key, value);
      });
    `);
  }

  const newUrl = store.get("lampaUrl");
  const currentUrl = mainWindow.webContents.getURL();
  let shouldReload = false;

  if (newUrl && newUrl !== currentUrlBefore) {
    await mainWindow.webContents.session.clearCache();
    await mainWindow.loadURL(newUrl);
    shouldReload = true;
  } else if (currentUrl.includes(newUrl || currentUrlBefore)) {
    mainWindow.webContents.reloadIgnoringCache();
    shouldReload = true;
  }

  if (shouldReload) {
    console.log("Ожидаем завершения загрузки страницы...");

    await new Promise((resolve) => {
      const checkLoad = () => {
        const state = mainWindow.webContents.getURL();

        if (state && !state.includes("about:blank")) {
          console.log("Страница считается загруженной:", state);
          resolve();
        } else {
          setTimeout(checkLoad, 100);
        }
      };

      checkLoad();

      mainWindow.webContents.once("did-finish-load", () => {
        console.log("Событие did-finish-load сработало");
        resolve();
      });
      setTimeout(resolve, 10000);
    });
  } else {
    injectPlugin(mainWindow);
  }
}

function registerSettingsHandlers(store, getMainWindow, injectPlugin) {
  ipcMain.handle("export-settings-to-file", async () => {
    try {
      const mainWindow = getMainWindow();
      const { app } = require("electron");

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Экспортировать настройки",
        defaultPath: "lampa-desktop-settings.json",
        filters: [{ name: "JSON файлы", extensions: ["json"] }],
      });

      if (canceled || !filePath) return;

      const localStorageData = await mainWindow.webContents.executeJavaScript(`
        Object.assign({}, localStorage);
      `);

      const settings = {
        appVersion: app.getVersion(),
        dateCreated: new Date().toISOString(),
        app: store.get(),
        lampa: localStorageData,
      };

      writeFileSync(filePath, JSON.stringify(settings, null, 2));

      console.log("Настройки успешно экспортированы");
      return { success: true, message: "Настройки успешно экспортированы" };
    } catch (err) {
      console.log(`Не удалось экспортировать настройки: ${err.message}`);
      return {
        success: false,
        message: `Не удалось экспортировать настройки: ${err.message}`,
      };
    }
  });

  ipcMain.handle("import-settings-from-file", async () => {
    try {
      const mainWindow = getMainWindow();

      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: "Импортировать настройки",
        filters: [{ name: "JSON файлы", extensions: ["json"] }],
        properties: ["openFile"],
      });

      if (canceled || !filePaths.length) return;

      if (filePaths.length > 1) {
        console.warn(
          "Выбрано несколько файлов, будет использован только первый",
        );
      }

      const data = readFileSync(filePaths[0], "utf-8");
      const settings = JSON.parse(data);

      if (typeof settings !== "object" || settings === null) {
        return {
          success: false,
          message: "Неверный формат файла",
        };
      }

      await importSettings(settings, store, mainWindow, injectPlugin);

      console.log("Settings imported successfully");
      return {
        success: true,
        message: "Настройки успешно импортированы, производим перезапуск...",
      };
    } catch (err) {
      console.log(`Error importing settings: ${err.message}`);
      return {
        success: false,
        message: `Не удалось импортировать настройки: ${err.message}`,
      };
    }
  });
}

// Экспортируем и функцию регистрации, и саму функцию импорта
module.exports = {
  registerSettingsHandlers,
  importSettings,
};
