const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { existsSync } = require("fs");
const { spawn } = require("child_process");
const which = require("which");
const http = require("http");
const httpProxy = require("http-proxy");

// region Proxy
// Создаём прокси-сервер (нацелен на VLC)
const proxy = httpProxy.createProxyServer({
  target: "http://localhost:3999", // Адрес VLC (по умолчанию)
  changeOrigin: true,
  secure: false,
});

proxy.on("error", (err, req, res) => {
  // console.error("Proxy error (connection dropped):", err);

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
    const targetPath = req.url.replace(/^\/vlc/, "") || "/";
    req.url = targetPath;

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
  console.log("Access VLC via http://localhost:3000/vlc");
  console.log("Proxying to VLC at http://localhost:3999");
});
// endregion Proxy

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
  });

  mainWindow.setMenu(null);
  mainWindow.loadURL("http://lampa.mx");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    if (process.platform === "darwin") {
      mainWindow.focus();
    }
  });

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
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });
  // открываем консоль
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }
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
