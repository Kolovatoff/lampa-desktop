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

let mainWindow;

// Создаём экземпляр хранилища
const store = new Store({
  defaults: {
    lampaUrl: "http://lampa.mx",
    fullscreen: false,
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

const proxyServer = server.listen(4000, "localhost", () => {
  console.log(`Proxy server running on http://localhost:4000`);
  console.log("Access VLC via /vlc to VLC at http://localhost:3999");
});
// endregion Proxy

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

ipcMain.handle("export-settings", async () => {
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

ipcMain.handle("import-settings", async () => {
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

const createWindow = () => {
  const savedState = loadWindowState();
  const displays = screen.getAllDisplays();

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
    icon: path.join(__dirname, "img", "og.png"),
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webSecurity: true,
    fullscreen: Boolean(store.get("fullscreen")),
  };

  if (savedState && savedState.width && savedState.height) {
    const targetDisplay = displays.find((d) => d.id === savedState.displayId);

    if (targetDisplay) {
      // Проверяем, что окно не выходит за пределы дисплея
      const displayBounds = targetDisplay.bounds;
      const maxX = displayBounds.x + displayBounds.width - savedState.width;
      const maxY = displayBounds.y + displayBounds.height - savedState.height;

      windowOptions.x = Math.max(displayBounds.x, Math.min(savedState.x, maxX));
      windowOptions.y = Math.max(displayBounds.y, Math.min(savedState.y, maxY));
      windowOptions.width = savedState.width;
      windowOptions.height = savedState.height;
    } else {
      // Если дисплей не найден, используем размеры, но на основном дисплее
      windowOptions.width = savedState.width;
      windowOptions.height = savedState.height;
    }
  } else {
    // Значения по умолчанию
    windowOptions.width = 1200;
    windowOptions.height = 800;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.setMenu(null);

  mainWindow.once("ready-to-show", () => {
    if (savedState && !windowOptions.fullscreen) {
      mainWindow.setBounds({
        x: windowOptions.x,
        y: windowOptions.y,
        width: windowOptions.width,
        height: windowOptions.height,
      });
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
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (proxyServer) proxyServer.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}
