// modules/lampaInitializer.js
const os = require("os");

class LampaInitializer {
  async initialize(mainWindow) {
    try {
      console.log("🔄 Инициализация Lampa...");

      await this.initializeBasicSettings(mainWindow);

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
}

module.exports = new LampaInitializer();
