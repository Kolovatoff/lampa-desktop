const { app } = require("electron");

const { setupAppLifecycle, gotTheLock } = require("./modules/appLifecycle");
const { createWindow } = require("./modules/windowManager");
const { setupAutoUpdater } = require("./modules/autoUpdater");
const { registerIpcHandlers } = require("./modules/ipcHandlers");
const torrServerManager = require("./modules/torrServerManager");
const autoStartManager = require("./modules/autoStartManager");
const VLCOptionsInterceptor = require("./modules/vlcOptionsInterceptor");
setupAppLifecycle();


registerIpcHandlers();

app.whenReady().then(async () => {
  if (!gotTheLock) return;

  VLCOptionsInterceptor.initialize();

  createWindow();

  setTimeout(async () => {
    try {
      await autoStartManager.initialize();
    } catch (error) {
      console.error("Ошибка при автозапуске TorrServer:", error);
    }
  }, 3000);

  app.on("activate", () => {
    const { BrowserWindow } = require("electron");
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  setupAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

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
      /* empty */
    }
  }
});
