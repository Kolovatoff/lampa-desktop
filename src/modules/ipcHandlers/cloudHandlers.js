const { ipcMain } = require("electron");
const {
  generatePin,
  encryptJson,
  decryptJson,
} = require("../utils/encryption");

// Импортируем функцию importSettings
const { importSettings } = require("./settingsHandlers");

function registerCloudHandlers(store, getMainWindow, injectPlugin) {
  ipcMain.handle("export-settings-to-cloud", async () => {
    try {
      const mainWindow = getMainWindow();
      const { app } = require("electron");

      const storageData = await mainWindow.webContents.executeJavaScript(`
        Object.assign({}, localStorage)
      `);

      const keysToDelete = ["platform", "app.js", "testsize"];
      keysToDelete.forEach((key) => {
        if (storageData[key]) {
          delete storageData[key];
        }
      });

      const settings = {
        appVersion: app.getVersion(),
        dateCreated: new Date().toISOString(),
        app: store.get(),
        lampa: storageData,
      };

      const pin = generatePin();

      return uploadJson(settings, pin)
        .then((data) => {
          mainWindow.webContents.executeJavaScript(`
            Lampa.Modal.open({
              title: "Экспорт",
              html: $(
                "<div><ul><li>Сохраните ID экспорта: ${data.id}</li><li>И пин-код для расшифровки: ${pin}</li></ul><ul><li>Внимание! Хранится на сервере 1 час.</li></ul></div>",
              ),
              size: "small",
              onBack: function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle("settings_component");
              },
            });
          `);
          return { success: true, message: "Настройки успешно экспортированы" };
        })
        .catch((error) => {
          console.error("Полная ошибка:", error);
          mainWindow.webContents.executeJavaScript(`
            Lampa.Noty.show("Ошибка экспорта");
          `);
          return {
            success: false,
            message: "Ошибка при экспорте в облако",
          };
        });
    } catch (err) {
      console.log(`Не удалось экспортировать настройки: ${err.message}`);
      return {
        success: false,
        message: `Не удалось экспортировать настройки: ${err.message}`,
      };
    }
  });

  ipcMain.handle("import-settings-from-cloud", async (event, id, pin) => {
    try {
      const mainWindow = getMainWindow();
      const settings = await downloadJson(id, pin);

      if (typeof settings !== "object" || settings === null) {
        return {
          success: false,
          message: "Неверный формат файла",
        };
      }

      // Используем импортированную функцию
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

async function uploadJson(jsonData, pin) {
  const pinStr = String(pin).padStart(4, "0");
  const encrypted = encryptJson(jsonData, pinStr);

  const response = await fetch("https://lampa.kolovatoff.ru/ei/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: encrypted }),
  });

  const result = await response.json();
  console.log("Upload result:", result);
  return result;
}

async function downloadJson(fileId, pin) {
  const pinStr = String(pin).padStart(4, "0");

  const response = await fetch(
    `https://lampa.kolovatoff.ru/ei/download?id=${fileId}`,
  );
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "Download failed");
  }

  return decryptJson(result.data, pinStr);
}

module.exports = registerCloudHandlers;
