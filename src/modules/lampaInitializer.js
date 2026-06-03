// modules/lampaInitializer.js
const os = require("os");
const playerFinder = require("./playerFinder");
const { existsSync } = require("fs");

class LampaInitializer {
  async initialize(mainWindow) {
    try {
      console.log("🔄 Инициализация Lampa...");

      await this.initializeBasicSettings(mainWindow);
      await this.initializePlayerPath(mainWindow);

      console.log("✅ Lampa инициализирована");
    } catch (error) {
      console.error("❌ Ошибка инициализации Lampa:", error);
    }
  }

  async initializeBasicSettings(mainWindow) {
    const deviceName = `${os.hostname()}`;

    await mainWindow.webContents.executeJavaScript(`
      (function() {
        const app_init_defaults = {
          device_name: '${deviceName}',
          platform: 'electron',
          player_torrent: 'other',
          poster_size: 'w500',
          torrserver_url: 'http://localhost:8090',
          torrserver_use_link: 'one'
        };

        Object.entries(app_init_defaults).forEach(([key, value]) => {
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, value);
          }
        });

        console.log('App', 'Базовые настройки применены');
      })();
    `);
  }

  async initializePlayerPath(mainWindow) {
    try {
      if (process.platform === "darwin") {
        console.log(`🍏 MacOS поиск плееров не требуется`);
        return;
      }

      // Проверяем, есть ли уже путь в localStorage
      const existingPath = await playerFinder.checkLocalStoragePath(mainWindow);

      if (existingPath && existsSync(existingPath)) {
        console.log(`✅ Путь к плееру уже есть: ${existingPath}`);
        return;
      }

      // Проверяем какой плеер выбран в Lampa
      const playerTorrent = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('player_torrent');
      `);

      // Если выбран внутренний плеер - не ищем внешний
      if (playerTorrent === "inner") {
        console.log("ℹ️ Выбран внутренний плеер, поиск внешнего отключен");
        return;
      }

      // Ищем все доступные плееры
      console.log("🔍 Поиск медиа плееров...");
      const players = await playerFinder.getAllPlayers();

      if (players.length === 0) {
        // НЕ НАЙДЕНО НИ ОДНОГО ПЛЕЕРА
        console.warn("⚠️ Медиа плееры не найдены!");

        await mainWindow.webContents.executeJavaScript(`
          setTimeout(() => {
            if (window.Lampa && window.Lampa.Noty) {
              window.Lampa.Noty.show(
                '⚠️ Медиа плеер не найден! Установите VLC, MPC-HC или mpv и укажите путь в настройках',
                'warning',
                10000
              );
            }
          }, 3000);
        `);
        return;
      }

      // Плееры найдены
      const defaultPlayer = await playerFinder.getDefaultPlayer();
      const playerList = players
        .map((p) => `${p.name}${p.isDefault ? " (по умолчанию)" : ""}`)
        .join(", ");
      console.log(`📺 Найдены плееры: ${playerList}`);

      // Сохраняем путь к плееру по умолчанию
      const success = await playerFinder.saveToLocalStorage(mainWindow);

      if (success) {
        console.log(
          `✅ Установлен плеер по умолчанию: ${defaultPlayer?.name} (${defaultPlayer?.path})`,
        );
      } else {
        console.error("❌ Не удалось сохранить путь к плееру");

        await mainWindow.webContents.executeJavaScript(`
          setTimeout(() => {
            if (window.Lampa && window.Lampa.Noty) {
              window.Lampa.Noty.show('❌ Не удалось сохранить путь к плееру', 'error', 5000);
            }
          }, 3000);
        `);
      }
    } catch (error) {
      console.error("❌ Ошибка при инициализации плеера:", error);

      await mainWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          if (window.Lampa && window.Lampa.Noty) {
            window.Lampa.Noty.show('❌ Ошибка при поиске плеера: ${error.message}', 'error', 5000);
          }
        }, 3000);
      `);
    }
  }
}

module.exports = new LampaInitializer();
