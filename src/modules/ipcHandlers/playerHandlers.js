// modules/ipcHandlers/playerHandlers.js
const { ipcMain } = require("electron");
const playerFinder = require("../playerFinder");
const { getMainWindow } = require("../windowManager");
const { macVlcPlayer } = require("../macVlc");
const { MacVlcTimecodes } = require("../macVlcTimecodes");
const store = require("../storeManager");

function registerPlayerHandlers() {
  const timecodes = new MacVlcTimecodes(store);
  const isMainWindow = (event) => {
    const window = getMainWindow();
    return (
      window && !window.isDestroyed() && event.sender === window.webContents
    );
  };
  const send = (channel, payload) => {
    const window = getMainWindow();
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  };
  macVlcPlayer.on("progress", (progress) => {
    timecodes.save(progress);
    send("player-mac-vlc-progress", progress);
  });
  macVlcPlayer.on("warning", (message) => {
    send("player-mac-vlc-warning", message);
  });
  ipcMain.handle("player-open-mac-vlc", async (event, request) => {
    if (!isMainWindow(event)) {
      return { success: false, error: "Unknown application window" };
    }
    return macVlcPlayer.open(request);
  });
  ipcMain.handle("player-mac-vlc-timecodes", (event) => {
    return isMainWindow(event) ? timecodes.all() : [];
  });
  ipcMain.handle("player-mac-vlc-acknowledge", (event, id, version) => {
    if (isMainWindow(event)) {
      timecodes.acknowledge(id, version);
    }
  });

  // Получить все плееры
  ipcMain.handle("player-get-all", async () => {
    return await playerFinder.getAllPlayers();
  });

  // Получить плеер по умолчанию
  ipcMain.handle("player-get-default", async () => {
    return await playerFinder.getDefaultPlayer();
  });

  // Установить плеер по умолчанию
  ipcMain.handle("player-set-default", async (event, playerId) => {
    const success = await playerFinder.setDefaultPlayer(playerId);
    if (success) {
      const mainWindow = getMainWindow();
      await playerFinder.saveToLocalStorage(mainWindow);
    }
    return success;
  });

  // Найти конкретный плеер
  ipcMain.handle("player-find", async (event, playerId) => {
    return await playerFinder.findPlayer(playerId);
  });

  // Найти все плееры
  ipcMain.handle("player-find-all", async () => {
    return await playerFinder.findAllPlayers();
  });

  // Диалог выбора вручную
  ipcMain.handle("player-select-manual", async () => {
    const mainWindow = getMainWindow();
    const path = await playerFinder.showManualSelectDialog(mainWindow);
    if (path) {
      await playerFinder.saveToLocalStorage(mainWindow, path);
    }
    return path;
  });

  // Сохранить путь в localStorage
  ipcMain.handle("player-save-path", async (event, playerPath) => {
    const mainWindow = getMainWindow();
    return await playerFinder.saveToLocalStorage(mainWindow, playerPath);
  });

  // Получить список доступных плееров
  ipcMain.handle("player-get-available", async () => {
    return playerFinder.getAvailablePlayersList();
  });
  ipcMain.handle("player-get-all-with-details", async () => {
    const players = await playerFinder.getAllPlayers();
    const defaultPlayer = await playerFinder.getDefaultPlayer();

    return {
      success: true,
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        description: player.description,
        path: player.path,
        isDefault: defaultPlayer ? player.id === defaultPlayer.id : false,
      })),
    };
  });

  // Установить плеер по умолчанию и сразу сохранить в localStorage
  ipcMain.handle("player-set-default-and-save", async (event, playerId) => {
    const mainWindow = getMainWindow();
    const success = await playerFinder.setDefaultPlayer(playerId);

    if (success) {
      // Сохраняем в localStorage Lampa
      const saved = await playerFinder.saveToLocalStorage(mainWindow);
      return { success: true, saved };
    }

    return { success: false };
  });
}

module.exports = registerPlayerHandlers;
