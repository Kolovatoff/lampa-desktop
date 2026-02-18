// modules/lampaInitializer.js
const os = require("os");

class LampaInitializer {
  async initialize(mainWindow) {
    try {
      console.log("🔄 Инициализация Lampa...");

      // Базовая инициализация
      await this.initializeBasicSettings(mainWindow);

      console.log("✅ Lampa инициализирована");
    } catch (error) {
      console.error("❌ Ошибка инициализации Lampa:", error);
    }
  }

  async initializeBasicSettings(mainWindow) {
    const deviceName = `Lampa ${os.hostname()}`;

    await mainWindow.webContents.executeJavaScript(`
            // Базовые настройки (только если не существуют)
            const defaults = {
                device_name: '${deviceName}',
                platform: 'electron',
                player_torrent: 'other',
                poster_size: 'w500'
            };

            Object.entries(defaults).forEach(([key, value]) => {
                if (!localStorage.getItem(key)) {
                    localStorage.setItem(key, value);
                }
            });

            console.log('Базовые настройки применены');
        `);
  }
}

module.exports = new LampaInitializer();
