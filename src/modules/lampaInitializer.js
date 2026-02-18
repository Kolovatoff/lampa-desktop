// modules/lampaInitializer.js
const os = require("os");
const vlcFinder = require("./vlcFinder");

class LampaInitializer {
  async initialize(mainWindow) {
    try {
      console.log("🔄 Инициализация Lampa...");

      // Базовая инициализация
      await this.initializeBasicSettings(mainWindow);

      // Поиск и сохранение пути к VLC
      await this.initializeVLCPath(mainWindow);

      console.log("✅ Lampa инициализирована");
    } catch (error) {
      console.error("❌ Ошибка инициализации Lampa:", error);
    }
  }

  async initializeBasicSettings(mainWindow) {
    const deviceName = `Lampa ${os.hostname()}`;

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

  async initializeVLCPath(mainWindow) {
    const existingPath = await vlcFinder.checkLocalStoragePath(mainWindow);

    if (existingPath && vlcFinder.validateVLC(existingPath)) {
      console.log(`✅ Путь к VLC уже есть: ${existingPath}`);
      return;
    }

    console.log("🔍 Автоматический поиск VLC...");
    const vlcPath = await vlcFinder.findVLC();

    if (vlcPath) {
      await vlcFinder.saveToLocalStorage(mainWindow, vlcPath);
    } else {
      await mainWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          if (window.Lampa?.Noty) {
            window.Lampa.Noty.show('VLC не найден. Видео может не работать. Установите VLC или другой плеер и укажите путь в настройках.', 15000);
          }
        }, 5000);
      `);
    }
  }
}

module.exports = new LampaInitializer();
