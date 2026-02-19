const Store = require("electron-store").default;

// Создаём экземпляр хранилища
const store = new Store({
  defaults: {
    lampaUrl: "http://lampa.mx",
    fullscreen: false,
    autoUpdate: true,
    windowState: {},
    tsVersion: null,
    tsPath: null,
    tsAutoStart: false,
    tsPort: 8090,
  },
});

module.exports = store;
