const { contextBridge, ipcRenderer } = require("electron");

// ============ Модуль для Node.js модулей ============
contextBridge.exposeInMainWorld("require", (module) => {
  if (module === "fs") {
    return {
      existsSync: (path) => {
        return ipcRenderer.sendSync("fs-existsSync", path);
      },
    };
  }
  if (module === "child_process") {
    return {
      spawn: (command, args, options) => {
        const id = Math.random().toString(36).substr(2, 9);
        ipcRenderer.send("child-process-spawn", id, command, args, options);
        return {
          on: (event, callback) => {
            if (event === "error") {
              ipcRenderer.once(
                `child-process-spawn-error-${id}`,
                (event, error) => callback(error),
              );
            } else if (event === "exit") {
              ipcRenderer.once(
                `child-process-spawn-exit-${id}`,
                (event, code) => callback(code),
              );
            }
          },
          stdout: {
            on: (event, callback) => {
              if (event === "data") {
                ipcRenderer.on(
                  `child-process-spawn-stdout-${id}`,
                  (event, data) => callback(data),
                );
              }
            },
          },
          stderr: {
            on: (event, callback) => {
              if (event === "data") {
                ipcRenderer.on(
                  `child-process-spawn-stderr-${id}`,
                  (event, data) => callback(data),
                );
              }
            },
          },
        };
      },
    };
  }
  return undefined;
});

// ============ Основное Electron API ============
contextBridge.exposeInMainWorld("electronAPI", {
  // Управление приложением
  closeApp: () => ipcRenderer.send("close-app"),
  toogleFullscreen: () => ipcRenderer.send("toggle-fullscreen"),
  loadUrl: (url) => ipcRenderer.send("load-url", url),
  getAppVersion: async () => {
    return await ipcRenderer.invoke("get-app-version");
  },

  // Работа с хранилищем
  store: {
    get: async (key) => {
      return await ipcRenderer.invoke("store-get", key);
    },
    set: async (key, value) => {
      return await ipcRenderer.invoke("store-set", key, value);
    },
    has: async (key) => {
      return await ipcRenderer.invoke("store-has", key);
    },
    delete: async (key) => {
      return await ipcRenderer.invoke("store-delete", key);
    },
  },

  // Экспорт/импорт настроек
  exportSettingsToCloud: async () => {
    return await ipcRenderer.invoke("export-settings-to-cloud");
  },
  importSettingsFromCloud: async (id, pin) => {
    return await ipcRenderer.invoke("import-settings-from-cloud", id, pin);
  },
  exportSettingsToFile: async () => {
    return await ipcRenderer.invoke("export-settings-to-file");
  },
  importSettingsFromFile: async () => {
    return await ipcRenderer.invoke("import-settings-from-file");
  },

  // Торрент сервер
  torrServer: {
    // Управление процессом
    start: (args) => ipcRenderer.invoke("torrserver-start", args),
    stop: () => ipcRenderer.invoke("torrserver-stop"),
    restart: (args) => ipcRenderer.invoke("torrserver-restart", args),
    getStatus: () => ipcRenderer.invoke("torrserver-status"),

    // Установка и обновление
    download: (version) => ipcRenderer.invoke("torrserver-download", version),
    checkUpdate: () => ipcRenderer.invoke("torrserver-check-update"),
    update: () => ipcRenderer.invoke("torrserver-update"),

    // Подписка на вывод процесса (для отображения логов в интерфейсе)
    onOutput: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on("torrserver-output", subscription);

      // Подписываемся на вывод (инициируем отправку логов из main процесса)
      ipcRenderer.send("torrserver-subscribe-output");

      // Возвращаем функцию для отписки
      return () => {
        ipcRenderer.removeListener("torrserver-output", subscription);
      };
    },

    // Короткая форма для проверки статуса (удобно для кнопок)
    isRunning: async () => {
      const status = await ipcRenderer.invoke("torrserver-status");
      return status.running;
    },
    uninstall: (keepData = false) =>
      ipcRenderer.invoke("torrserver-uninstall", { keepData }),
    isInstalled: () => ipcRenderer.invoke("torrserver-is-installed"),
  },

  // Работа с папками
  folder: {
    open: (path) => ipcRenderer.invoke("folder-open", path),
  },
});

console.log("Preload script loaded successfully");
