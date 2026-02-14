const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  screen,
} = require("electron");
const path = require("node:path");
const { existsSync, readFileSync, writeFileSync } = require("fs");
const { spawn } = require("child_process");
const which = require("which");
const http = require("http");
const Store = require("electron-store").default;
const httpProxy = require("http-proxy");
const { autoUpdater } = require("electron-updater");

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Настройка автообновлений
autoUpdater.logger = console;
autoUpdater.autoDownload = true;

let mainWindow;

// Создаём экземпляр хранилища
const store = new Store({
  defaults: {
    lampaUrl: "http://lampa.mx",
    fullscreen: false,
    autoUpdate: true,
    windowState: {},
  },
});
store.onDidChange("lampaUrl", (newValue) => {
  mainWindow.loadURL(newValue);
});

ipcMain.handle("store-get", (event, key) => {
  return store.get(key);
});
ipcMain.handle("store-set", (event, key, value) => {
  store.set(key, value);
});
ipcMain.handle("store-has", (event, key) => {
  return store.has(key); // возвращает true/false
});
ipcMain.handle("store-delete", (event, key) => {
  if (store.has(key)) {
    store.delete(key);
    return true; // успешно удалено
  }
  return false; // ключа не было
});

// region Proxy
// Создаём прокси-сервер (нацелен на VLC)
const proxy = httpProxy.createProxyServer({
  target: "http://localhost:3999", // Адрес VLC (по умолчанию)
  changeOrigin: true,
  secure: false,
});

proxy.on("error", (err, req, res) => {
  // Немедленно закрываем соединение
  if (!res.finished) {
    res.destroy();
  } else {
    res.socket?.destroy();
  }
});

// HTTP-сервер с маршрутизацией
const server = http.createServer((req, res) => {
  // Проверяем, начинается ли путь с /vlc
  if (req.url.startsWith("/vlc")) {
    // console.log(`Received request: ${req.method} ${req.url}`);

    // Для OPTIONS всегда возвращаем 200 с CORS-заголовками
    if (req.method === "OPTIONS") {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Length": "0",
      });
      res.end();
      return;
    }

    // Для остальных методов (GET, POST и т.д.) — проксируем в VLC
    // Удаляем префикс /vlc для передачи в VLC
    req.url = req.url.replace(/^\/vlc/, "") || "/";

    // Добавляем CORS-заголовки для ответов VLC
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    // Проксируем запрос в VLC
    proxy.web(req, res);
  } else {
    // Для всех других путей — ответ 404
    res.writeHead(404, {
      "Content-Type": "text/plain",
    });
    res.end("Not Found. Use /vlc path for VLC proxy.");
  }
});
let proxyServer = null;
// endregion Proxy

// region Автообновления
autoUpdater.on("checking-for-update", () => {
  console.log("Checking for updates...");
});

autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info);
});

autoUpdater.on("update-not-available", (info) => {
  console.log("No updates available:", info);
});

autoUpdater.on("error", (err) => {
  console.error("Auto-update error:", err);
});

autoUpdater.on("download-progress", (progressObj) => {
  console.log(`Downloading: ${progressObj.percent}%`);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info);
  dialog
    .showMessageBox({
      type: "info",
      title: "Обновление готово",
      message: "Новое обновление загружено. Перезапустить приложение?",
      buttons: ["Да", "Позже"],
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});
// endregion Автообновления

function setupPluginHandler() {
  mainWindow.webContents.on("did-finish-load", async () => {
    try {
      await waitForLampaReady();
      injectPlugin();
    } catch (err) {
      console.error("Ошибка при перезагрузке:", err);
    }
  });
}
async function waitForLampaReady() {
  return new Promise((resolve) => {
    const check = async () => {
      const isReady = await mainWindow.webContents
        .executeJavaScript("window.Lampa !== undefined", true)
        .catch(() => false);

      if (isReady) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}
function injectPlugin() {
  const pluginCode = readFileSync(path.join(__dirname, "plugin.js"), "utf-8");
  mainWindow.webContents
    .executeJavaScript(pluginCode)
    .then(() => {
      console.log("Плагин успешно внедрён");
    })
    .catch((err) => {
      console.error("Ошибка внедрения плагина:", err);
    });
}
function saveWindowState(state) {
  store.set("windowState", state);
}

function loadWindowState() {
  const state = store.get("windowState");

  if (
    state &&
    typeof state === "object" &&
    "x" in state &&
    "y" in state &&
    "width" in state &&
    "height" in state
  ) {
    return state;
  }

  return null;
}

function generatePin() {
  const pin = Math.floor(Math.random() * 10000);
  return pin.toString().padStart(4, "0");
}

// Шифрование JSON с PIN и отправка на сервер
async function uploadJson(jsonData, pin) {
  // Преобразуем PIN в строку и дополняем нулями до 4 символов
  const pinStr = String(pin).padStart(4, "0");

  const jsonString = JSON.stringify(jsonData);
  let encrypted = "";

  for (let i = 0; i < jsonString.length; i++) {
    const charCode = jsonString.charCodeAt(i);
    const key = parseInt(pinStr[i % 4], 10);
    encrypted += String.fromCharCode(charCode ^ key);
  }

  const encryptedB64 = btoa(unescape(encodeURIComponent(encrypted)));

  const response = await fetch("https://lampa.kolovatoff.ru/ei/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: encryptedB64 }),
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

  const encryptedB64 = result.data;

  const encryptedStep1 = atob(encryptedB64);
  const encryptedStep2 = escape(encryptedStep1);
  const encrypted = decodeURIComponent(encryptedStep2);

  let decrypted = "";
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const key = parseInt(pinStr[i % 4], 10);
    decrypted += String.fromCharCode(charCode ^ key);
  }

  return JSON.parse(decrypted);
}

ipcMain.handle("export-settings-to-cloud", async () => {
  try {
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
        console.error("Полная ошибка:", error); // смотрим в консоли
        mainWindow.webContents.executeJavaScript(`
          Lampa.Noty.show("Ошибка экспорта");
        `);
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
    const settings = await downloadJson(id, pin);
    // const settings = JSON.parse(data);

    if (typeof settings !== "object" || settings === null) {
      return {
        success: false,
        message: "Неверный формат файла",
      };
    }

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
        Lampa.Cache.clearAll()

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
      injectPlugin();
    }

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

ipcMain.handle("export-settings-to-file", async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Экспортировать настройки",
      defaultPath: "lampa-desktop-settings.json",
      filters: [{ name: "JSON файлы", extensions: ["json"] }],
    });

    if (canceled || !filePath) return;

    const localStorageData = await mainWindow.webContents.executeJavaScript(`
      Object.assign({}, localStorage)
    `);

    const settings = {
      appVersion: app.getVersion(),
      dateCreated: new Date().toISOString(),
      app: store.get(),
      lampa: localStorageData,
    };

    // Сохраняем в файл
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
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Импортировать настройки",
      filters: [{ name: "JSON файлы", extensions: ["json"] }],
      properties: ["openFile"],
    });

    if (canceled || !filePaths.length) return;

    if (filePaths.length > 1) {
      // Обработка случая, если почему-то выбрано несколько файлов
      console.warn("Выбрано несколько файлов, будет использован только первый");
    }

    const data = readFileSync(filePaths[0], "utf-8");
    const settings = JSON.parse(data);

    if (typeof settings !== "object" || settings === null) {
      return {
        success: false,
        message: "Неверный формат файла",
      };
    }

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
        Lampa.Cache.clearAll()

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
      injectPlugin();
    }

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

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

const createWindow = () => {
  const savedState = loadWindowState();
  const displays = screen.getAllDisplays();

  if (process.argv.includes("--dev")) {
    console.log("List displays:", displays);
  }

  let windowOptions = {
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
    },
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webSecurity: true,
    fullscreen: Boolean(store.get("fullscreen")),
  };

  let targetDisplay;
  if (savedState && savedState.displayId) {
    targetDisplay = displays.find((d) => d.id === savedState.displayId);
  }
  if (!targetDisplay) {
    targetDisplay = displays[0];
  }

  const displayBounds = targetDisplay.bounds;

  if (savedState && savedState.width && savedState.height) {
    const maxX = displayBounds.x + displayBounds.width - savedState.width;
    const maxY = displayBounds.y + displayBounds.height - savedState.height;

    windowOptions.x = Math.max(
      displayBounds.x,
      Math.min(savedState.x || 0, maxX),
    );
    windowOptions.y = Math.max(
      displayBounds.y,
      Math.min(savedState.y || 0, maxY),
    );
    windowOptions.width = savedState.width;
    windowOptions.height = savedState.height;
  } else {
    windowOptions.width = 1200;
    windowOptions.height = 800;
    windowOptions.x = displayBounds.x;
    windowOptions.y = displayBounds.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.setMenu(null);

  mainWindow.once("ready-to-show", () => {
    if (savedState && !windowOptions.fullscreen) {
      try {
        mainWindow.setBounds({
          x: windowOptions.x,
          y: windowOptions.y,
          width: windowOptions.width,
          height: windowOptions.height,
        });
      } catch (error) {
        console.error("Ошибка при установке границ окна:", error);
        // Устанавливаем безопасные значения по умолчанию
        mainWindow.setBounds({ x: 0, y: 0, width: 1200, height: 800 });
      }
    }

    mainWindow.show();

    if (process.platform === "darwin") {
      mainWindow.focus();
    }
  });

  const lampaUrl = store.get("lampaUrl");
  mainWindow.loadURL(lampaUrl);

  setupPluginHandler();

  const saveState = () => {
    if (
      !mainWindow.isDestroyed() &&
      !mainWindow.isMaximized() &&
      !mainWindow.isMinimized() &&
      !mainWindow.isFullScreen()
    ) {
      const bounds = mainWindow.getBounds();
      const display = screen.getDisplayMatching(bounds);

      const windowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        displayId: display.id,
        maximized: mainWindow.isMaximized(),
      };

      saveWindowState(windowState);
    }
  };

  // Сохраняем состояние при перемещении и изменении размера
  mainWindow.on("move", saveState);
  mainWindow.on("resize", saveState);

  mainWindow.on("close", () => {
    if (!mainWindow.isDestroyed()) {
      const bounds = mainWindow.getNormalBounds
        ? mainWindow.getNormalBounds()
        : mainWindow.getBounds();
      const display = screen.getDisplayMatching(bounds);

      const windowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        displayId: display.id,
        maximized: mainWindow.isMaximized(),
      };

      saveWindowState(windowState);
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  let isReloadingFromHandler = false;

  // решение проблемы с нерабочим window.location.reload() в лампе
  mainWindow.webContents.on(
    "did-start-navigation",
    (event, url, isInPlace, isMainFrame) => {
      const currentUrl = mainWindow.webContents.getURL();

      if (isMainFrame && url === currentUrl) {
        console.log("Reload request detected:", {
          url,
          currentUrl,
          initiator: event.initiator,
          isInPlace,
        });

        // Проверяем, что это не наш собственный reload
        if (!isReloadingFromHandler && event.initiator) {
          console.log("Preventing default reload and using Electron reload");
          event.preventDefault();

          isReloadingFromHandler = true;
          setTimeout(() => {
            mainWindow.webContents.reload();
            // Сбрасываем флаг после небольшой задержки
            setTimeout(() => {
              isReloadingFromHandler = false;
            }, 100);
          }, 10);
        } else {
          console.log("Skipping - this is our own reload call");
        }
      }
    },
  );

  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== "file://") {
      event.preventDefault();
    }
  });

  // Обрабатываем ошибки загрузки
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      const errorHTML = `
        <div style="
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 40px;
          color: #333;
          background-color: #f8f8f8;
          border: 1px solid #ddd;
          max-width: 600px;
          margin: 0 auto;
        ">
          <h1>Ошибка загрузки страницы</h1>
          <p><strong>Код ошибки:</strong> ${errorCode}</p>
          <p><strong>Описание:</strong> ${errorDescription}</p>
          <p><strong>Текущий URL:</strong> ${validatedURL}</p>

          <div style="margin: 20px 0;">
            <input
              id="customUrlInput"
              type="text"
              placeholder="Введите новый URL (например, http://lampa.mx)"
              style="
                width: 80%;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 16px;
              "
            />
          </div>

          <div style="display: flex; gap: 10px; justify-content: center;">
            <button
              onclick="handleDefaultReload()"
              style="
                padding: 10px 20px;
                background-color: #28a745;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              "
            >
              Загрузить LAMPA.MX
            </button>
            <button
              onclick="handleCustomReload()"
              style="
                padding: 10px 20px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              "
            >
              Перейти
            </button>
          </div>
        </div>

        <script>
          // Функция для загрузки lampa.mx по умолчанию
          async function handleDefaultReload() {
            try {
              await window.electronAPI.setStoreValue('lampaUrl', 'http://lampa.mx');
              window.electronAPI.loadUrl('http://lampa.mx');
            } catch (err) {
              console.error('Ошибка:', err);
              alert('Не удалось загрузить lampa.mx: ' + err.message);
            }
          }

          // Функция для загрузки пользовательского URL
          async function handleCustomReload() {
            const input = document.getElementById('customUrlInput');
            const url = input.value.trim();

            // Проверка на пустоту
            if (!url) {
              alert('Пожалуйста, введите URL!');
              return;
            }

            try {
              // Сохраняем в хранилище
              await window.electronAPI.setStoreValue('lampaUrl', url);

              // Перезагружаем страницу
              window.electronAPI.loadUrl(url);
            } catch (err) {
              console.error('Ошибка:', err);
              alert('Не удалось перейти по URL: ' + err.message);
            }
          }
        </script>
      `;

      // Вставляем HTML в тело страницы
      mainWindow.webContents.executeJavaScript(`
        document.write(${JSON.stringify(errorHTML)});
        document.close();
      `);
    },
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // открываем консоль
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  ipcMain.on("toggle-fullscreen", () => {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.setFullScreen(true);
    }
  });

  ipcMain.on("reload-page", (event, url) => {
    mainWindow.loadURL(url).catch((err) => {
      console.error("Ошибка загрузки URL:", err);
    });
  });

  ipcMain.on("close-app", () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });
};

// IPC обработчик для fs-existsSync
ipcMain.on("fs-existsSync", async (event, filePath) => {
  try {
    const resolvedPath = await which(filePath, { path: process.env.PATH });
    event.returnValue = existsSync(resolvedPath);
  } catch {
    event.returnValue = false;
  }
});

// IPC обработчик для child-process-spawn
ipcMain.on("child-process-spawn", async (event, id, cmd, args, opts) => {
  try {
    const resolvedCmd = await which(cmd, {
      path: opts?.env?.PATH || process.env.PATH,
    });
    const spawnOptions = opts || {};
    spawnOptions.env = { ...process.env, ...(opts?.env || {}) };
    const child = spawn(resolvedCmd, args, spawnOptions);
    child.on("error", (err) => {
      event.sender.send(`child-process-spawn-error-${id}`, err);
    });
    child.on("exit", (code) => {
      event.sender.send(`child-process-spawn-exit-${id}`, code);
    });
    child.stdout.on("data", (data) => {
      event.sender.send(`child-process-spawn-stdout-${id}`, data);
    });
    child.stderr.on("data", (data) => {
      event.sender.send(`child-process-spawn-stderr-${id}`, data);
    });
  } catch (err) {
    event.sender.send(
      `child-process-spawn-error-${id}`,
      new Error(`Command ${cmd} not found: ${err.message}`),
    );
  }
});

app.whenReady().then(async () => {
  // Проверяем, что мы — единственный экземпляр
  if (!gotTheLock) return;

  proxyServer = server.listen(4000, "localhost", () => {
    console.log(`Proxy server running on http://localhost:4000`);
    console.log("Access VLC via /vlc to VLC at http://localhost:3999");
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  setTimeout(() => {
    if (store.get("autoUpdate")) {
      autoUpdater.checkForUpdates().catch(console.error);
    }
    // autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    //   console.error("Ошибка при автоматической проверке обновлений:", err);
    // });
  }, 5000);
});

app.on("window-all-closed", () => {
  if (proxyServer) proxyServer.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (proxyServer) {
    proxyServer.close(() => {
      console.log("Proxy server on port 4000 closed");
    });
  }
});

app.on("will-quit", () => {
  if (proxyServer) {
    proxyServer.close();
  }
});
