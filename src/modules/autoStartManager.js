// modules/autoStartManager.js
const store = require("./storeManager");
const torrServerManager = require("./torrServerManager");

class AutoStartManager {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log("🔄 Проверка автозапуска TorrServer...");
    const autoStart = store.get("tsAutoStart");

    if (!autoStart) {
      console.log("⏸️ Автозапуск TorrServer отключен в настройках");
      return;
    }

    try {
      const installed = await torrServerManager.isInstalled();

      if (!installed.installed) {
        console.log("⚠️ TorrServer не установлен, пропускаем автозапуск");
        return;
      }

      // Получаем дополнительные аргументы из настроек
      const port = store.get("tsPort") || 8090;

      // Формируем аргументы для запуска
      const startArgs = ["--port", port.toString()];

      console.log("🚀 Автозапуск TorrServer с аргументами:", startArgs);

      // Запускаем TorrServer
      const result = await torrServerManager.start(startArgs);

      if (result.success) {
        console.log("✅ TorrServer успешно запущен автоматически");

        // Добавляем небольшую задержку для полной инициализации
        setTimeout(() => {
          console.log(
            "📡 TorrServer доступен по адресу: http://localhost:" + port,
          );
        }, 2000);
      } else {
        console.error("❌ Ошибка автозапуска TorrServer:", result.error);
      }
    } catch (error) {
      console.error("❌ Критическая ошибка автозапуска:", error);
    }

    this.initialized = true;
  }
}

const autoStartManager = new AutoStartManager();
module.exports = autoStartManager;
