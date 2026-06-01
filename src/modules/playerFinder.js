// modules/playerFinder.js
const { existsSync } = require("fs");
const path = require("path");
const store = require("./storeManager");

// Список поддерживаемых плееров
const PLAYERS = {
  vlc: {
    name: "VLC",
    description: "VLC Media Player",
    platforms: {
      win32: {
        paths: [
          path.join(
            process.env.ProgramFiles || "C:\\Program Files",
            "VideoLAN",
            "VLC",
            "vlc.exe",
          ),
          path.join(
            process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
            "VideoLAN",
            "VLC",
            "vlc.exe",
          ),
        ],
      },
      darwin: {
        paths: ["/Applications/VLC.app/Contents/MacOS/VLC"],
      },
      linux: {
        paths: ["/usr/bin/vlc", "/usr/local/bin/vlc", "/snap/bin/vlc"],
      },
    },
  },
  mpc_hc: {
    name: "MPC-HC",
    description: "Media Player Classic Home Cinema",
    platforms: {
      win32: {
        paths: [
          path.join(
            process.env.ProgramFiles || "C:\\Program Files",
            "MPC-HC",
            "mpc-hc64.exe",
          ),
          path.join(
            process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
            "MPC-HC",
            "mpc-hc.exe",
          ),
        ],
      },
      darwin: { paths: [] },
      linux: { paths: [] },
    },
  },
  mpc_be: {
    name: "MPC-BE",
    description: "Media Player Classic Black Edition",
    platforms: {
      win32: {
        paths: [
          path.join(
            process.env.ProgramFiles || "C:\\Program Files",
            "MPC-BE",
            "mpc-be64.exe",
          ),
          path.join(
            process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
            "MPC-BE",
            "mpc-be.exe",
          ),
        ],
      },
      darwin: { paths: [] },
      linux: { paths: [] },
    },
  },
  mpc_qt: {
    name: "MPC-QT",
    description: "Media Player Classic Qute Theater",
    platforms: {
      win32: {
        paths: [
          path.join(
            process.env.ProgramFiles || "C:\\Program Files",
            "MPC-QT",
            "mpc-qt64.exe",
          ),
          path.join(
            process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
            "MPC-QT",
            "mpc-qt.exe",
          ),
        ],
      },
      darwin: { paths: [] },
      linux: {
        paths: ["/usr/bin/mpc-qt", "/usr/local/bin/mpc-qt", "/snap/bin/mpc-qt"],
      },
    },
  },
};

class PlayerFinder {
  constructor() {
    this.foundPlayers = new Map();
    this.defaultPlayerId = null;
  }

  // Поиск всех плееров на системе
  async findAllPlayers() {
    const platform = process.platform;
    console.log(`🔍 Поиск плееров на ${platform}...`);

    for (const [playerId, playerInfo] of Object.entries(PLAYERS)) {
      const platformPaths = playerInfo.platforms[platform];
      if (!platformPaths || !platformPaths.paths.length) continue;

      for (const playerPath of platformPaths.paths) {
        if (existsSync(playerPath)) {
          this.foundPlayers.set(playerId, {
            id: playerId,
            name: playerInfo.name,
            description: playerInfo.description,
            path: playerPath,
          });
          console.log(`✅ Найден ${playerInfo.name}: ${playerPath}`);
          break;
        }
      }
    }

    // Загружаем выбранный плеер по умолчанию
    this.defaultPlayerId = store.get("defaultPlayer", null);

    if (this.defaultPlayerId && !this.foundPlayers.has(this.defaultPlayerId)) {
      console.log(
        `⚠️ Выбранный плеер ${this.defaultPlayerId} не найден, сбрасываем`,
      );
      this.defaultPlayerId = null;
      store.delete("defaultPlayer");
    }

    return this.foundPlayers;
  }

  // Поиск конкретного плеера
  async findPlayer(playerId) {
    const player = PLAYERS[playerId];
    if (!player) return null;

    const platform = process.platform;
    const platformPaths = player.platforms[platform];

    if (!platformPaths || !platformPaths.paths.length) return null;

    for (const playerPath of platformPaths.paths) {
      if (existsSync(playerPath)) {
        return {
          id: playerId,
          name: player.name,
          description: player.description,
          path: playerPath,
        };
      }
    }
    return null;
  }

  // Получить плеер по умолчанию
  async getDefaultPlayer() {
    if (this.foundPlayers.size === 0) {
      await this.findAllPlayers();
    }

    if (!this.defaultPlayerId && this.foundPlayers.size > 0) {
      const firstPlayer = Array.from(this.foundPlayers.values())[0];
      this.defaultPlayerId = firstPlayer.id;
      store.set("defaultPlayer", firstPlayer.id);
      return firstPlayer;
    }

    return this.foundPlayers.get(this.defaultPlayerId) || null;
  }

  // Получить путь к плееру по умолчанию
  async getDefaultPlayerPath() {
    const player = await this.getDefaultPlayer();
    return player ? player.path : null;
  }

  // Установить плеер по умолчанию
  async setDefaultPlayer(playerId) {
    const player = await this.findPlayer(playerId);
    if (!player) return false;

    this.defaultPlayerId = playerId;
    store.set("defaultPlayer", playerId);

    if (!this.foundPlayers.has(playerId)) {
      this.foundPlayers.set(playerId, player);
    }

    console.log(`🎯 Установлен плеер по умолчанию: ${player.name}`);
    return true;
  }

  // Получить все найденные плееры
  async getAllPlayers() {
    if (this.foundPlayers.size === 0) {
      await this.findAllPlayers();
    }

    const defaultPlayer = await this.getDefaultPlayer();

    return Array.from(this.foundPlayers.values()).map((player) => ({
      id: player.id,
      name: player.name,
      description: player.description,
      path: player.path,
      isDefault: defaultPlayer ? player.id === defaultPlayer.id : false,
    }));
  }

  // Проверить путь в localStorage Lampa
  async checkLocalStoragePath(mainWindow) {
    try {
      return await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('player_nw_path');
      `);
    } catch (error) {
      console.error("❌ Ошибка чтения player_nw_path:", error);
      return null;
    }
  }

  // Сохранить путь в localStorage Lampa
  async saveToLocalStorage(mainWindow, playerPath = null) {
    let finalPath = playerPath;
    let playerInfo = null;

    if (!finalPath) {
      const defaultPlayer = await this.getDefaultPlayer();
      if (!defaultPlayer) return false;
      finalPath = defaultPlayer.path;
      playerInfo = defaultPlayer;
    }

    if (!finalPath || !existsSync(finalPath)) {
      console.error(`❌ Путь не существует: ${finalPath}`);
      return false;
    }

    try {
      const escapedPath = finalPath.replace(/\\/g, "\\\\");

      await mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('player_nw_path', '${escapedPath}');
        localStorage.setItem('player_torrent', 'other');
        console.log('App', '✅ player_nw_path сохранен:', '${escapedPath}');
        console.log('App', '✅ player_torrent сохранен:', 'other');

        if (window.Lampa && window.Lampa.Storage) {
          window.Lampa.Storage.set('player_nw_path', '${escapedPath}');
          window.Lampa.Storage.set('player_torrent', 'other');
        }
      `);

      console.log(
        `✅ Путь сохранен: ${finalPath} ${playerInfo ? `(${playerInfo.name})` : ""}`,
      );
      return true;
    } catch (error) {
      console.error("❌ Ошибка сохранения:", error);
      return false;
    }
  }

  // Диалог выбора плеера вручную
  async showManualSelectDialog(mainWindow) {
    const { dialog } = require("electron");

    const filters =
      process.platform === "win32"
        ? [{ name: "Media Player", extensions: ["exe"] }]
        : [{ name: "Media Player", extensions: ["*"] }];

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Выберите медиа плеер",
      defaultPath:
        process.platform === "win32" ? "C:\\Program Files" : "/usr/bin",
      filters: filters,
      properties: ["openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  }

  // Получить список доступных плееров (для настроек)
  getAvailablePlayersList() {
    const platform = process.platform;
    return Object.entries(PLAYERS).map(([id, info]) => ({
      id,
      name: info.name,
      description: info.description,
      supported: !!(
        info.platforms[platform] && info.platforms[platform].paths.length
      ),
    }));
  }
}

module.exports = new PlayerFinder();
