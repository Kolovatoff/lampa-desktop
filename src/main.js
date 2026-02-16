const { app } = require("electron");

// Импорт модулей
const { setupAppLifecycle, gotTheLock } = require("./modules/appLifecycle");
const { createWindow } = require("./modules/windowManager");
const { setupProxyServer, closeProxyServer } = require("./modules/proxyServer");
const { setupAutoUpdater } = require("./modules/autoUpdater");
const { registerIpcHandlers } = require("./modules/ipcHandlers");

// Настройка жизненного цикла приложения (один экземпляр)
setupAppLifecycle();

// Регистрация всех IPC-обработчиков
registerIpcHandlers();

app.whenReady().then(async () => {
  // Проверяем, что мы — единственный экземпляр
  if (!gotTheLock) return;

  // Запуск прокси-сервера
  setupProxyServer();

  // Создание главного окна
  createWindow();

  app.on("activate", () => {
    const { BrowserWindow } = require("electron");
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Настройка автообновлений
  setupAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Единый обработчик с защитой от множественных вызовов
let isQuitting = false;
app.on("will-quit", async (event) => {
  if (isQuitting) {
    event.preventDefault();
    return;
  }

  isQuitting = true;

  try {
    await closeProxyServer();
  } catch (error) {
    console.error("Error closing proxy:", error);
  }
});
