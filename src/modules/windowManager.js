const { BrowserWindow, screen } = require("electron");
const path = require("node:path");
const store = require("./storeManager");
const { setupPluginHandler } = require("./pluginHandler");

let mainWindow = null;

function getMainWindow() {
  return mainWindow;
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

function createWindow() {
  const savedState = loadWindowState();
  const displays = screen.getAllDisplays();

  if (process.argv.includes("--dev")) {
    console.log("List displays:", displays);
  }

  let windowOptions = {
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
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

  setupPluginHandler(mainWindow);

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

  setupNavigationHandlers(mainWindow);
  setupErrorHandler(mainWindow);
  setupWindowOpenHandler(mainWindow);

  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

function setupNavigationHandlers(mainWindow) {
  let isReloadingFromHandler = false;

  mainWindow.webContents.on(
    "did-start-navigation",
    (event, url, isInPlace, isMainFrame) => {
      const currentUrl = mainWindow.webContents.getURL();

      if (isMainFrame && url === currentUrl) {
        console.log("Reload request detected");

        if (!isReloadingFromHandler && event.initiator) {
          console.log("Preventing default reload and using Electron reload");
          event.preventDefault();

          isReloadingFromHandler = true;
          setTimeout(() => {
            mainWindow.webContents.reload();
            setTimeout(() => {
              isReloadingFromHandler = false;
            }, 100);
          }, 10);
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
}

function setupErrorHandler(mainWindow) {
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
          async function handleDefaultReload() {
            try {
              await window.electronAPI.store.set('lampaUrl', 'http://lampa.mx');
              window.electronAPI.loadUrl('http://lampa.mx');
            } catch (err) {
              console.error('Ошибка:', err);
              alert('Не удалось загрузить lampa.mx: ' + err.message);
            }
          }

          async function handleCustomReload() {
            const input = document.getElementById('customUrlInput');
            const url = input.value.trim();

            if (!url) {
              alert('Пожалуйста, введите URL!');
              return;
            }

            try {
              await window.electronAPI.store.set('lampaUrl', url);
              window.electronAPI.loadUrl(url);
            } catch (err) {
              console.error('Ошибка:', err);
              alert('Не удалось перейти по URL: ' + err.message);
            }
          }
        </script>
      `;

      mainWindow.webContents.executeJavaScript(`
        document.write(${JSON.stringify(errorHTML)});
        document.close();
      `);
    },
  );
}

function setupWindowOpenHandler(mainWindow) {
  const { shell } = require("electron");

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

module.exports = {
  createWindow,
  getMainWindow,
};
