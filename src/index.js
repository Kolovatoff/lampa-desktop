const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { existsSync, readFileSync } = require("fs");
const { spawn } = require("child_process");
const which = require("which");
const http = require("http");
const Store = require("electron-store").default;
const httpProxy = require("http-proxy");

// Создаём экземпляр хранилища
const store = new Store({
  defaults: {
    lampaUrl: "http://lampa.mx",
    fullscreen: false,
  },
});

store.onDidChange("lampaUrl", (newValue) => {
  mainWindow.loadURL(newValue);
  setupDomReadyHandler();
});

function setupDomReadyHandler() {
  // Удаляем предыдущий обработчик (если есть)
  mainWindow.webContents.removeAllListeners("dom-ready");

  // Устанавливаем новый
  mainWindow.webContents.once("dom-ready", () => {
    console.log("DOM готов, запускаем плагин...");
    injectPlugin();
  });
}

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

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
  });

  mainWindow.setMenu(null);

  const lampaUrl = store.get("lampaUrl");
  mainWindow.loadURL(lampaUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    if (process.platform === "darwin") {
      mainWindow.focus();
    }
  });

  setupDomReadyHandler();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== "file://") {
      event.preventDefault();
    }
  });

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
