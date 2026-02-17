// modules/ipcHandlers/torrServerHandlers.js
const { ipcMain } = require("electron");
const torrServerManager = require("../torrServerManager");

function registerTorrServerHandlers() {
  // Запуск
  ipcMain.handle("torrserver-start", async (event, args) => {
    return await torrServerManager.start(args);
  });

  // Остановка
  ipcMain.handle("torrserver-stop", async () => {
    return await torrServerManager.stop();
  });

  // Перезапуск
  ipcMain.handle("torrserver-restart", async (event, args) => {
    return await torrServerManager.restart(args);
  });

  // Статус
  ipcMain.handle("torrserver-status", () => {
    return torrServerManager.getStatus();
  });

  // Загрузка/установка
  ipcMain.handle("torrserver-download", async (event, version) => {
    return await torrServerManager.download(version);
  });

  // Проверка обновлений
  ipcMain.handle("torrserver-check-update", async () => {
    return await torrServerManager.checkForUpdate();
  });

  // Обновление
  ipcMain.handle("torrserver-update", async () => {
    return await torrServerManager.update();
  });

  // Удаление
  ipcMain.handle(
    "torrserver-uninstall",
    async (event, options = { keepData: false }) => {
      return await torrServerManager.uninstall(options);
    },
  );

  // Проверка установки
  ipcMain.handle("torrserver-is-installed", async () => {
    return await torrServerManager.isInstalled();
  });

  // Подписка на вывод
  ipcMain.on("torrserver-subscribe-output", (event) => {
    const unsubscribe = torrServerManager.onOutput((output) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("torrserver-output", output);
      }
    });

    // Автоматическая отписка при закрытии окна
    event.sender.once("destroyed", unsubscribe);
  });
}

module.exports = registerTorrServerHandlers;
