const { autoUpdater } = require("electron-updater");
const { dialog } = require("electron");
const store = require("./storeManager");

function setupAutoUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;

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

  setTimeout(() => {
    if (store.get("autoUpdate")) {
      autoUpdater.checkForUpdates().catch(console.error);
    }
  }, 5000);
}

module.exports = {
  setupAutoUpdater,
};
