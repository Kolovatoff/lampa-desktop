// modules/storeManager.js
const Store = require("electron-store").default;

const isDev =
  process.argv.includes("--dev") || process.env.NODE_ENV === "development";

let configName = "config";
if (isDev) {
  configName = "config-dev";
  console.log("🔧 Dev режим: используется config-dev.json");
}

const store = new Store({
  name: configName,
  defaults: {
    lampaUrl: "http://lampa.mx",
    fullscreen: false,
    webSecurity: true,
    autoUpdate: true,
    windowState: {},
    tsVersion: null,
    tsPath: null,
    tsAutoStart: false,
    tsPort: 8090,
    defaultPlayer: "vlc",
  },
});

module.exports = store;
