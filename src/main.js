const { app } = require("electron");

// Импорт модулей
const { setupAppLifecycle, gotTheLock } = require("./modules/appLifecycle");
const { createWindow } = require("./modules/windowManager");
const { setupProxyServer, closeProxyServer } = require("./modules/proxyServer");
const { setupAutoUpdater } = require("./modules/autoUpdater");
const { registerIpcHandlers } = require("./modules/ipcHandlers");
const torrServerManager = require("./modules/torrServerManager");
const autoStartManager = require("./modules/autoStartManager");

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

  setTimeout(async () => {
    try {
      await autoStartManager.initialize();
    } catch (error) {
      console.error("Ошибка при автозапуске TorrServer:", error);
    }
  }, 3000); // Задержка 3 секунды после старта приложения

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

  // Предотвращаем немедленный выход
  event.preventDefault();
  isQuitting = true;

  console.log("🔄 Завершение работы приложения...");

  try {
    console.log("🛑 Остановка TorrServer...");

    const stopResult = await Promise.race([
      torrServerManager.stop(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout stopping TorrServer")),
          5000,
        ),
      ),
    ]);

    console.log("✅ TorrServer остановлен:", stopResult);
  } catch (error) {
    console.error("❌ Ошибка при остановке TorrServer:", error);

    // Принудительное завершение, если процесс все еще существует
    if (torrServerManager.process) {
      try {
        torrServerManager.process.kill("SIGKILL");
        console.log("⚠️ TorrServer принудительно завершен");
      } catch (killError) {
        console.error(
          "❌ Не удалось принудительно завершить TorrServer:",
          killError,
        );
      }
    }
  }

  try {
    // Останавливаем прокси-сервер
    console.log("🛑 Остановка прокси-сервера...");
    await closeProxyServer();
    console.log("✅ Прокси-сервер остановлен");
  } catch (error) {
    console.error("❌ Ошибка при остановке прокси-сервера:", error);
  }

  console.log("👋 Завершение приложения");
  app.exit();
});

// Дополнительный обработчик на случай, если will-quit не сработает
app.on("before-quit", () => {
  if (torrServerManager.process && !isQuitting) {
    console.log("⚠️ Принудительное завершение TorrServer перед выходом");
    try {
      torrServerManager.process.kill("SIGKILL");
    } catch {
      // Игнорируем ошибки при завершении
    }
  }
});
