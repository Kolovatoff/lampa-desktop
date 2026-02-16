const { readFileSync } = require("fs");
const path = require("node:path");

function setupPluginHandler(mainWindow) {
  mainWindow.webContents.on("did-finish-load", async () => {
    try {
      await waitForLampaReady(mainWindow);
      injectPlugin(mainWindow);
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

function injectPlugin(mainWindow) {
  const pluginCode = readFileSync(
    path.join(__dirname, "..", "plugin.js"),
    "utf-8",
  );
  mainWindow.webContents
    .executeJavaScript(pluginCode)
    .then(() => {
      console.log("Плагин успешно внедрён");
    })
    .catch((err) => {
      console.error("Ошибка внедрения плагина:", err);
    });
}

module.exports = {
  setupPluginHandler,
  injectPlugin,
};
