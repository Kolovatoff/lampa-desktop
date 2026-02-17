// modules/torrServerManager.js
const { app } = require("electron");
const { spawn } = require("child_process");
const path = require("node:path");
const fs = require("node:fs").promises;
const { existsSync } = require("node:fs");
const https = require("node:https");
const { pipeline } = require("node:stream/promises");
const { createWriteStream } = require("node:fs");
const store = require("./storeManager");

// Конфигурация
const GITHUB_API =
  "https://api.github.com/repos/YouROK/TorrServer/releases/latest";

class TorrServerManager {
  constructor() {
    this.process = null;
    this.status = "stopped";
    this.currentVersion = null;
    this.executablePath = null;
    this.outputListeners = [];
  }

  // ---------- Определение платформы ----------
  getPlatformInfo() {
    const platform = process.platform;
    const arch = process.arch;
    let osName = "";

    switch (platform) {
      case "win32":
        osName = "windows";
        break;
      case "darwin":
        osName = "darwin";
        break;
      case "linux":
        osName = "linux";
        break;
      default:
        throw new Error(`Неподдерживаемая ОС: ${platform}`);
    }

    let archSuffix = "";
    if (platform === "win32") {
      archSuffix = arch === "x64" ? "amd64" : arch;
    } else if (platform === "darwin") {
      archSuffix = arch === "arm64" ? "arm64" : "amd64";
    } else if (platform === "linux") {
      archSuffix = arch === "x64" ? "amd64" : arch;
    }

    const exeName =
      platform === "win32"
        ? `TorrServer-${osName}-${archSuffix}.exe`
        : `TorrServer-${osName}-${archSuffix}`;

    const saveDir = path.join(app.getPath("userData"), "torrserver");
    const savePath = path.join(saveDir, exeName);

    // Папка для данных TorrServer (config.db и т.д.)
    const dataDir = path.join(saveDir, "data");

    return {
      platform,
      arch,
      osName,
      archSuffix,
      exeName,
      saveDir,
      savePath,
      dataDir,
    };
  }

  // ---------- Создание необходимых папок ----------
  async ensureDirectories() {
    const info = this.getPlatformInfo();

    try {
      // Создаем основную папку
      await fs.mkdir(info.saveDir, { recursive: true });

      // Создаем папку для данных (важно!)
      await fs.mkdir(info.dataDir, { recursive: true });

      console.log("✅ Директории созданы:", {
        saveDir: info.saveDir,
        dataDir: info.dataDir,
      });

      return true;
    } catch (error) {
      console.error("❌ Ошибка создания директорий:", error);
      throw error;
    }
  }

  // ---------- Получение последней версии с GitHub ----------
  async getLatestRelease() {
    try {
      const response = await fetch(GITHUB_API, {
        headers: { "User-Agent": "Electron-App" },
      });
      const data = await response.json();

      if (!data.tag_name) {
        throw new Error("Не удалось получить информацию о версии");
      }

      this.currentVersion = data.tag_name;
      return {
        version: data.tag_name,
        assets: data.assets || [],
      };
    } catch (error) {
      console.error("Ошибка получения последней версии:", error);
      throw error;
    }
  }

  // ---------- Загрузка TorrServer ----------
  async download(version = "latest") {
    const info = this.getPlatformInfo();

    try {
      // Сначала создаем все необходимые папки
      await this.ensureDirectories();

      // Получаем информацию о последнем релизе
      const release = await this.getLatestRelease();
      const targetVersion = version === "latest" ? release.version : version;

      // Ищем нужный asset
      const asset = release.assets.find((a) => a.name === info.exeName);
      if (!asset) {
        throw new Error(`Не найден файл ${info.exeName} в релизе`);
      }

      const downloadUrl = `https://github.com/YouROK/TorrServer/releases/download/${targetVersion}/${info.exeName}`;

      console.log(`📥 Загрузка TorrServer ${targetVersion}...`);

      const response = await new Promise((resolve, reject) => {
        https
          .get(downloadUrl, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
              https.get(res.headers.location, resolve).on("error", reject);
            } else if (res.statusCode === 200) {
              resolve(res);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          })
          .on("error", reject);
      });

      // Сохраняем файл
      const fileStream = createWriteStream(info.savePath);
      await pipeline(response, fileStream);

      // Для Linux/Mac делаем файл исполняемым
      if (info.platform !== "win32") {
        await fs.chmod(info.savePath, 0o755);
      }

      // Сохраняем версию в store
      store.set("tsVersion", targetVersion);
      store.set("tsPath", info.savePath);

      this.executablePath = info.savePath;
      console.log(`✅ TorrServer успешно загружен в ${info.savePath}`);

      return { success: true, path: info.savePath, version: targetVersion };
    } catch (error) {
      console.error("❌ Ошибка загрузки TorrServer:", error);
      return { success: false, message: error.message };
    }
  }

  // ---------- Запуск TorrServer ----------
  async start(args = []) {
    if (this.process) {
      return { success: false, message: "TorrServer уже запущен" };
    }

    try {
      const info = this.getPlatformInfo();

      // Создание папки перед каждым запуском
      await this.ensureDirectories();

      // Проверяем наличие исполняемого файла
      const savedPath = store.get("tsPath");

      this.executablePath =
        savedPath && existsSync(savedPath) ? savedPath : info.savePath;

      if (!existsSync(this.executablePath)) {
        console.log("⚠️ Исполняемый файл не найден, скачиваем...");
        const downloadResult = await this.download();
        if (!downloadResult.success) {
          throw new Error("Не удалось скачать TorrServer");
        }
      }

      // Аргументы по умолчанию
      const defaultArgs = [
        "--ip",
        store.get("tsHost") || "localhost",
        "--port",
        store.get("tsPort") || "8090",
        "--path",
        info.dataDir, // Используем правильный путь к папке данных
      ];

      // Объединяем с пользовательскими аргументами
      const allArgs = [...defaultArgs, ...args];

      console.log("🚀 Запуск TorrServer с аргументами:", allArgs);
      console.log("📁 Рабочая папка:", info.saveDir);
      console.log("📁 Папка данных:", info.dataDir);

      this.status = "starting";

      // Запускаем процесс
      this.process = spawn(this.executablePath, allArgs, {
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: info.saveDir, // Устанавливаем рабочую директорию
        env: {
          ...process.env,
          HOME: info.saveDir, // Для Unix систем
          USERPROFILE: info.saveDir, // Для Windows
        },
      });

      // Обработка stdout
      this.process.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[TorrServer stdout]: ${output}`);
        this.notifyListeners("stdout", output);
      });

      // Обработка stderr
      this.process.stderr.on("data", (data) => {
        const output = data.toString();
        console.error(`[TorrServer stderr]: ${output}`);
        this.notifyListeners("stderr", output);
      });

      // Обработка завершения
      this.process.on("exit", (code, signal) => {
        console.log(
          `TorrServer завершился с кодом ${code} (сигнал: ${signal})`,
        );
        this.process = null;
        this.status = "stopped";
        this.notifyListeners("exit", { code, signal });
      });

      this.process.on("error", (err) => {
        console.error("❌ Ошибка процесса TorrServer:", err);
        this.status = "error";
        this.notifyListeners("error", err);
      });

      // Ждем немного и проверяем, что процесс жив
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Проверяем, не завершился ли процесс сразу
      if (this.process && this.process.pid) {
        // Дополнительная проверка: процесс все еще жив?
        try {
          process.kill(this.process.pid, 0); // Сигнал 0 только проверяет существование
          this.status = "running";
          console.log("✅ TorrServer успешно запущен, PID:", this.process.pid);
          return {
            success: true,
            message: "TorrServer запущен",
            pid: this.process.pid,
            port: defaultArgs[1],
          };
        } catch {
          // Процесс мертв
          this.process = null;
          this.status = "error";
          throw new Error("Процесс завершился сразу после запуска");
        }
      } else {
        throw new Error("Процесс не запустился");
      }
    } catch (error) {
      console.error("❌ Ошибка запуска TorrServer:", error);
      this.status = "error";
      return { success: false, message: error.message };
    }
  }

  // ---------- Остановка TorrServer ----------
  async stop() {
    if (!this.process) {
      return { success: false, message: "TorrServer не запущен" };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          console.log("⚠️ Принудительное завершение TorrServer");
          this.process.kill("SIGKILL");
        }
      }, 5000);

      this.process.once("exit", () => {
        clearTimeout(timeout);
        this.process = null;
        this.status = "stopped";
        console.log("✅ TorrServer остановлен");
        resolve({ success: true, message: "TorrServer остановлен" });
      });

      // Пытаемся завершить процесс мягко
      if (process.platform === "win32") {
        this.process.kill("SIGINT");
      } else {
        this.process.kill("SIGTERM");
      }
    });
  }

  // ---------- Перезапуск ----------
  async restart(args = []) {
    console.log("🔄 Перезапуск TorrServer...");
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return this.start(args);
  }

  // ============ НОВОЕ: Удаление TorrServer ============
  async uninstall(options = { keepData: false }) {
    try {
      // Сначала останавливаем, если запущен
      if (this.process) {
        console.log("🛑 Останавливаем TorrServer перед удалением...");
        await this.stop();
      }

      const info = this.getPlatformInfo();
      const deletedItems = [];

      // Удаляем исполняемый файл
      if (existsSync(info.savePath)) {
        await fs.unlink(info.savePath);
        deletedItems.push(info.savePath);
        console.log(`🗑️ Удален исполняемый файл: ${info.savePath}`);
      }

      // Удаляем папку с данными, если не указано keepData: true
      if (!options.keepData && existsSync(info.dataDir)) {
        await fs.rm(info.dataDir, { recursive: true, force: true });
        deletedItems.push(info.dataDir);
        console.log(`🗑️ Удалена папка с данными: ${info.dataDir}`);
      }

      // Удаляем основную папку, если она пуста или если не нужно сохранять данные
      if (existsSync(info.saveDir)) {
        if (options.keepData) {
          // Если нужно сохранить данные, удаляем только исполняемый файл
          console.log("💾 Данные сохранены (keepData=true)");
        } else {
          // Иначе удаляем всю папку torrserver
          await fs.rm(info.saveDir, { recursive: true, force: true });
          deletedItems.push(info.saveDir);
          console.log(`🗑️ Удалена основная папка: ${info.saveDir}`);
        }
      }

      // Очищаем store
      store.delete("tsVersion");
      store.delete("tsPath");

      // Сбрасываем состояние менеджера
      this.executablePath = null;
      this.currentVersion = null;

      console.log("✅ TorrServer успешно удален");

      return {
        success: true,
        message: options.keepData
          ? "TorrServer удален (данные сохранены)"
          : "TorrServer полностью удален",
        deletedItems,
        keepData: options.keepData,
      };
    } catch (error) {
      console.error("❌ Ошибка удаления TorrServer:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ---------- Проверка установки ----------
  async isInstalled() {
    const info = this.getPlatformInfo();
    const version = store.get("tsVersion");

    return {
      installed: existsSync(info.savePath) && !!version,
      executableExists: existsSync(info.savePath),
      version: version,
      path: info.savePath,
      dataDir: info.dataDir,
    };
  }

  // ---------- Проверка обновлений ----------
  async checkForUpdate() {
    try {
      const currentVersion = store.get("tsVersion");
      const latest = await this.getLatestRelease();

      if (!currentVersion) {
        return { hasUpdate: true, current: null, latest: latest.version };
      }

      const hasUpdate = latest.version !== currentVersion;

      return {
        hasUpdate,
        current: currentVersion,
        latest: latest.version,
      };
    } catch (error) {
      console.error("Ошибка проверки обновлений:", error);
      return { hasUpdate: false, message: error.message };
    }
  }

  // ---------- Обновление ----------
  async update() {
    const check = await this.checkForUpdate();

    if (!check.hasUpdate) {
      return {
        success: false,
        message: "Уже установлена последняя версия",
        current: check.current,
      };
    }

    const wasRunning = this.process !== null;
    if (wasRunning) {
      await this.stop();
    }

    const downloadResult = await this.download("latest");

    if (downloadResult.success && wasRunning) {
      await this.start();
    }

    return downloadResult;
  }

  // ---------- Получение статуса ----------
  getStatus() {
    const info = this.getPlatformInfo();
    return {
      status: this.status,
      running: this.process !== null,
      pid: this.process?.pid || null,
      version: store.get("tsVersion") || null,
      path: store.get("tsPath") || null,
      host: store.get("tsHost") || "localhost",
      port: store.get("tsPort") || 8090,
      dataDir: info.dataDir,
      executableDir: info.saveDir,
      installed: existsSync(info.savePath),
    };
  }

  // ---------- Управление выводом ----------
  onOutput(callback) {
    this.outputListeners.push(callback);
    return () => {
      this.outputListeners = this.outputListeners.filter(
        (cb) => cb !== callback,
      );
    };
  }

  notifyListeners(type, data) {
    this.outputListeners.forEach((cb) =>
      cb({ type, data, timestamp: Date.now() }),
    );
  }
}

// Создаем и экспортируем синглтон
const torrServerManager = new TorrServerManager();
module.exports = torrServerManager;
