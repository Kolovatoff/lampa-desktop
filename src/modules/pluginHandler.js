const { readFileSync } = require("fs");
const path = require("node:path");
const lampaInitializer = require("./lampaInitializer");

function setupPluginHandler(mainWindow) {
  mainWindow.webContents.on("did-finish-load", async () => {
    try {
      await waitForLampaReady(mainWindow);
      await lampaInitializer.initialize(mainWindow);
      await injectPlugin(mainWindow);
    } catch (err) {
      console.error("Ошибка при перезагрузке:", err);
    }
  });
}

async function waitForLampaReady(mainWindow) {
  return new Promise((resolve) => {
    const check = async () => {
      const isReady = await mainWindow.webContents
        .executeJavaScript("window.Lampa !== undefined", true)
        .catch(() => false);

      if (isReady) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

async function injectPlugin(mainWindow) {
  const plugins =
    process.platform === "darwin"
      ? ["macVlcPlugin.js", "plugin.js"]
      : ["plugin.js"];

  for (const plugin of plugins) {
    try {
      const pluginCode = readFileSync(
        path.join(__dirname, "..", plugin),
        "utf-8",
      );
      await mainWindow.webContents.executeJavaScript(pluginCode);
      console.log(`Плагин успешно внедрён: ${plugin}`);
    } catch (err) {
      console.error(`Ошибка внедрения плагина ${plugin}:`, err);
    }
  }
}

module.exports = {
  setupPluginHandler,
  injectPlugin,
};
