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
    this.gstSupport = null;
    this.version = null;
  }

  // Определение платформы
  getPlatformInfo(useGst = null) {
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

    if (useGst === null) {
      useGst = store.get("tsUseGst", false);
    }

    // Имя файла на GitHub (с суффиксом -gst или без)
    const gstSuffix = useGst ? "-gst" : "";
    const githubExeName =
      platform === "win32"
        ? `TorrServer${gstSuffix}-${osName}-${archSuffix}.exe`
        : `TorrServer${gstSuffix}-${osName}-${archSuffix}`;

    // Локальное имя файла (всегда одинаковое)
    const localExeName = platform === "win32" ? "torrserver.exe" : "torrserver";
    const saveDir = path.join(app.getPath("userData"), "torrserver");
    const savePath = path.join(saveDir, localExeName);
    const dataDir = path.join(saveDir, "data");

    return {
      platform,
      arch,
      osName,
      archSuffix,
      githubExeName,
      localExeName,
      saveDir,
      savePath,
      dataDir,
      useGst,
    };
  }

  // Создание необходимых папок
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

  // Получение последней версии с GitHub
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

  // Загрузка TorrServer
  async download(version = "latest") {
    const info = this.getPlatformInfo();

    try {
      // Сначала создаем все необходимые папки
      await this.ensureDirectories();

      // Получаем информацию о последнем релизе
      const release = await this.getLatestRelease();
      const targetVersion = version === "latest" ? release.version : version;

      // Логируем текущие настройки
      console.log(`📥 Загрузка TorrServer ${targetVersion}...`);
      console.log(
        `🔧 Настройка GST: ${info.useGst ? "включена" : "отключена"}`,
      );
      console.log(`📦 Ищем файл: ${info.githubExeName}`);

      // Ищем нужный asset на GitHub
      const asset = release.assets.find((a) => a.name === info.githubExeName);
      if (!asset) {
        console.error(`❌ Файл ${info.githubExeName} не найден в релизе`);
        console.log(
          `📋 Доступные файлы:`,
          release.assets.map((a) => a.name).join(", "),
        );

        // Если файл с GST не найден, пробуем без GST
        if (info.useGst) {
          console.log("🔄 Пробуем скачать версию без GST...");
          const fallbackInfo = this.getPlatformInfo(false);
          const fallbackAsset = release.assets.find(
            (a) => a.name === fallbackInfo.githubExeName,
          );

          if (fallbackAsset) {
            console.log("✅ Найден файл без GST, скачиваем его");
            // Временно меняем настройку
            store.set("tsUseGst", false);
            store.set("tsGstEnabled", false);

            // Скачиваем без GST
            const result = await this.downloadWithInfo(version, fallbackInfo);
            // Возвращаем настройку обратно
            store.set("tsUseGst", info.useGst);
            store.set("tsGstEnabled", info.useGst);
            return {
              ...result,
              warning: "Файл с GST не найден, скачана версия без GST",
              useGst: false,
            };
          }
        }

        throw new Error(`Не найден файл ${info.githubExeName} в релизе`);
      }

      // Скачиваем файл
      const downloadUrl = `https://github.com/YouROK/TorrServer/releases/download/${targetVersion}/${info.githubExeName}`;

      console.log(`🌐 URL для скачивания: ${downloadUrl}`);

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

      const fileStream = createWriteStream(info.savePath);
      await pipeline(response, fileStream);

      // Для Linux/Mac делаем файл исполняемым
      if (info.platform !== "win32") {
        await fs.chmod(info.savePath, 0o755);
      }

      // Сохраняем информацию о версии и настройках
      store.set("tsVersion", targetVersion);
      store.set("tsPath", info.savePath);
      store.set("tsUseGst", info.useGst);
      store.set("tsGstEnabled", info.useGst);

      this.executablePath = info.savePath;

      console.log(`✅ TorrServer успешно загружен в ${info.savePath}`);
      console.log(
        `🔧 Поддержка GST: ${info.useGst ? "включена" : "отключена"}`,
      );

      return {
        success: true,
        path: info.savePath,
        version: targetVersion,
        useGst: info.useGst,
      };
    } catch (error) {
      console.error("❌ Ошибка загрузки TorrServer:", error);
      return { success: false, message: error.message };
    }
  }

  // Вспомогательный метод для скачивания с указанными настройками
  async downloadWithInfo(version, info) {
    try {
      await this.ensureDirectories();

      const release = await this.getLatestRelease();
      const targetVersion = version === "latest" ? release.version : version;

      const asset = release.assets.find((a) => a.name === info.githubExeName);
      if (!asset) {
        throw new Error(`Не найден файл ${info.githubExeName} в релизе`);
      }

      const downloadUrl = `https://github.com/YouROK/TorrServer/releases/download/${targetVersion}/${info.githubExeName}`;

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

      const fileStream = createWriteStream(info.savePath);
      await pipeline(response, fileStream);

      if (info.platform !== "win32") {
        await fs.chmod(info.savePath, 0o755);
      }

      store.set("tsVersion", targetVersion);
      store.set("tsPath", info.savePath);
      store.set("tsUseGst", info.useGst);
      store.set("tsGstEnabled", info.useGst);

      this.executablePath = info.savePath;

      return {
        success: true,
        path: info.savePath,
        version: targetVersion,
        useGst: info.useGst,
      };
    } catch (error) {
      console.error("❌ Ошибка загрузки:", error);
      return { success: false, message: error.message };
    }
  }

  // Проверка поддержки GStreamer
  async checkGstSupport(port = 8090) {
    try {
      const baseUrl = `http://localhost:${port}`;

      // Проверяем /gst/echo
      const response = await fetch(`${baseUrl}/gst/echo`, {
        signal: AbortSignal.timeout(3000),
      });

      if (response.status === 404) {
        // Если /gst/echo возвращает 404, значит поддержки GST нет
        this.gstSupport = false;
        return { supported: false };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Проверяем, что все компоненты работают
      const allWorks =
        data.gst_discoverer?.works &&
        data.gstreamer?.works &&
        data.hdr_tone_mapping?.works &&
        data.embedded_runtime?.works;

      this.gstSupport = allWorks;

      return {
        supported: allWorks,
        details: data,
        gstreamerVersion: data.gstreamer?.version,
      };
    } catch (error) {
      console.error("Ошибка проверки поддержки GST:", error);
      this.gstSupport = false;
      return { supported: false, error: error.message };
    }
  }

  // Получение версии TorrServer
  async getVersion(port = 8090) {
    try {
      const response = await fetch(`http://localhost:${port}/echo`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      // Ожидаем ответ типа "MatriX.142.2"
      const match = text.match(/MatriX\.([\d.]+)/);
      if (match) {
        this.version = match[1];
        return this.version;
      }

      this.version = text.trim();
      return this.version;
    } catch (error) {
      console.error("Ошибка получения версии TorrServer:", error);
      return null;
    }
  }

  // Получение полной информации о сервере
  async getServerInfo(port = 8090) {
    const info = {
      version: null,
      gstSupported: false,
      gstDetails: null,
      gstreamerVersion: null,
    };

    try {
      // Получаем версию
      info.version = await this.getVersion(port);

      // Получаем информацию о GST
      const gstInfo = await this.checkGstSupport(port);
      info.gstSupported = gstInfo.supported;
      info.gstDetails = gstInfo.details || null;
      info.gstreamerVersion = gstInfo.gstreamerVersion || null;

      return info;
    } catch (error) {
      console.error("Ошибка получения информации о сервере:", error);
      return info;
    }
  }

  // Запуск TorrServer
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
      const useGst = store.get("tsUseGst", false);

      this.executablePath =
        savedPath && existsSync(savedPath) ? savedPath : info.savePath;

      // Проверяем, установлен ли TorrServer
      if (!existsSync(this.executablePath)) {
        console.log("⚠️ Исполняемый файл не найден, скачиваем...");
        const downloadResult = await this.download();
        if (!downloadResult.success) {
          throw new Error("Не удалось скачать TorrServer");
        }
      }

      // Проверяем соответствие настройки GST с установленной версией
      // Для этого проверяем, что версия в store соответствует текущей настройке
      const installedVersion = store.get("tsVersion");
      const installedGst = store.get("tsGstEnabled", false);

      if (installedVersion && installedGst !== useGst) {
        console.log("⚠️ Настройка GST изменилась, требуется переустановка");
        console.log(
          `   Было: ${installedGst ? "с GST" : "без GST"}, стало: ${useGst ? "с GST" : "без GST"}`,
        );

        // Удаляем старый файл
        try {
          if (existsSync(this.executablePath)) {
            await fs.unlink(this.executablePath);
            console.log(`🗑️ Удален старый файл: ${this.executablePath}`);
          }
        } catch (unlinkError) {
          console.warn(
            "⚠️ Не удалось удалить старый файл:",
            unlinkError.message,
          );
        }

        // Скачиваем новую версию с нужной настройкой
        console.log("📥 Скачиваем TorrServer с новой настройкой GST...");
        const downloadResult = await this.download();
        if (!downloadResult.success) {
          throw new Error("Не удалось скачать TorrServer с новой настройкой");
        }

        // Обновляем путь к исполняемому файлу
        this.executablePath = info.savePath;

        // Обновляем статус в store
        store.set("tsGstEnabled", useGst);
      }

      // Проверяем, что файл теперь существует
      if (!existsSync(this.executablePath)) {
        throw new Error("Исполняемый файл не найден после установки");
      }

      const defaultArgs = [
        "--port",
        store.get("tsPort") || "8090",
        "--path",
        info.dataDir, // Используем правильный путь к папке данных
      ];

      const allArgs = [...defaultArgs, ...args];

      console.log("🚀 Запуск TorrServer с аргументами:", allArgs);
      console.log("📁 Рабочая папка:", info.saveDir);
      console.log("📁 Папка данных:", info.dataDir);
      console.log("🔧 Поддержка GST:", useGst);
      console.log("📄 Исполняемый файл:", this.executablePath);

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
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Проверяем, не завершился ли процесс сразу
      if (this.process && this.process.pid) {
        // Дополнительная проверка: процесс все еще жив?
        try {
          process.kill(this.process.pid, 0); // Сигнал 0 только проверяет существование
          this.status = "running";
          console.log("✅ TorrServer успешно запущен, PID:", this.process.pid);

          // Получаем информацию о сервере
          const port = defaultArgs[1];
          let serverInfo = {
            version: null,
            gstSupported: null,
            gstreamerVersion: null,
          };

          try {
            serverInfo = await this.getServerInfo(port);

            // Обновляем информацию о GST в store, если сервер ответил
            if (serverInfo.gstSupported !== null) {
              store.set("tsGstEnabled", serverInfo.gstSupported);
            }
          } catch (infoError) {
            console.warn(
              "⚠️ Не удалось получить информацию о сервере:",
              infoError.message,
            );
          }

          return {
            success: true,
            message: "TorrServer запущен",
            pid: this.process.pid,
            port: port,
            version: serverInfo.version || store.get("tsVersion"),
            gstSupported: serverInfo.gstSupported,
            gstreamerVersion: serverInfo.gstreamerVersion,
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

  // Остановка TorrServer
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

  // Перезапуск
  async restart(args = []) {
    console.log("🔄 Перезапуск TorrServer...");
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return this.start(args);
  }

  // Переустановка TorrServer
  async reinstall(args = []) {
    console.log("🔄 Переустановка TorrServer...");

    // Останавливаем, если запущен
    if (this.process) {
      await this.stop();
    }

    // Удаляем старый файл (всегда с одинаковым именем)
    const info = this.getPlatformInfo();
    if (existsSync(info.savePath)) {
      await fs.unlink(info.savePath);
      console.log(`🗑️ Удален старый файл: ${info.savePath}`);
    }

    // Удаляем старый файл (требуется для обратной совместимости) Потом удалить.
    const savedPath = store.get("tsPath");
    const executablePath =
      savedPath && existsSync(savedPath) ? savedPath : info.savePath;
    if (existsSync(executablePath)) {
      await fs.unlink(executablePath);
      console.log(`🗑️ Удален старый файл: ${executablePath}`);
    }

    // Скачиваем заново с текущими настройками
    const downloadResult = await this.download();
    if (!downloadResult.success) {
      return downloadResult;
    }

    // Запускаем
    return this.start(args);
  }

  // Удаление TorrServer
  async uninstall(options = { keepData: false }) {
    try {
      if (this.process) {
        console.log("🛑 Останавливаем TorrServer перед удалением...");
        await this.stop();
      }

      const info = this.getPlatformInfo();
      const deletedItems = [];

      // Получаем актуальный путь к файлу
      const savedPath = store.get("tsPath");
      const executablePath =
        savedPath && existsSync(savedPath) ? savedPath : info.savePath;

      // Удаляем исполняемый файл
      if (existsSync(executablePath)) {
        await fs.unlink(executablePath);
        deletedItems.push(executablePath);
        console.log(`🗑️ Удален исполняемый файл: ${executablePath}`);
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
          // При сохранении данных - удаляем только файл TorrServer,
          // но оставляем папку data
        } else {
          // Проверяем, что в папке больше нет файлов
          const files = await fs.readdir(info.saveDir);
          if (files.length === 0) {
            await fs.rm(info.saveDir, { recursive: true, force: true });
            deletedItems.push(info.saveDir);
            console.log(`🗑️ Удалена основная папка: ${info.saveDir}`);
          } else {
            console.log(
              `📁 Папка не удалена (содержит файлы: ${files.join(", ")})`,
            );
          }
        }
      }

      // Сохраняем настройку GST перед очисткой
      const useGst = store.get("tsUseGst", false);

      // Очищаем store, но сохраняем настройку GST если keepData: true
      store.delete("tsVersion");
      store.delete("tsPath");

      // Если не сохраняем данные, сбрасываем и настройку GST
      if (!options.keepData) {
        store.delete("tsUseGst");
        store.delete("tsGstEnabled");
      } else {
        // Если сохраняем данные, проверяем что настройка GST сохранена
        console.log(
          `💾 Настройка GST сохранена: ${useGst ? "включена" : "отключена"}`,
        );
        // Убеждаемся, что настройка сохранена
        store.set("tsUseGst", useGst);
        store.set("tsGstEnabled", useGst);
      }

      // Сбрасываем состояние менеджера
      this.executablePath = null;
      this.currentVersion = null;
      this.gstSupport = null;
      this.version = null;

      console.log("✅ TorrServer успешно удален");
      console.log(
        `🔧 Настройка GST: ${store.get("tsUseGst", false) ? "включена" : "отключена"}`,
      );

      return {
        success: true,
        message: options.keepData
          ? "TorrServer удален (данные сохранены)"
          : "TorrServer полностью удален",
        deletedItems,
        keepData: options.keepData,
        useGst: store.get("tsUseGst", false),
      };
    } catch (error) {
      console.error("❌ Ошибка удаления TorrServer:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Проверка установки
  async isInstalled() {
    const info = this.getPlatformInfo();
    const version = store.get("tsVersion");
    const useGst = store.get("tsUseGst", false);
    const savedPath = store.get("tsPath");

    // Проверяем по сохраненному пути или по стандартному пути
    const executablePath =
      savedPath && existsSync(savedPath) ? savedPath : info.savePath;

    const installed = existsSync(executablePath) && !!version;

    return {
      installed: installed,
      executableExists: existsSync(executablePath),
      version: version,
      path: executablePath,
      dataDir: info.dataDir,
      useGst: useGst,
      gstMismatch:
        installed && store.get("tsGstEnabled") !== undefined
          ? store.get("tsGstEnabled") !== useGst
          : false,
    };
  }

  // Проверка обновлений
  async checkForUpdate() {
    try {
      const currentVersion = store.get("tsVersion");
      const useGst = store.get("tsUseGst", false);
      const latest = await this.getLatestRelease();

      if (!currentVersion) {
        return {
          hasUpdate: true,
          current: null,
          latest: latest.version,
          useGst: useGst,
        };
      }

      const hasUpdate = latest.version !== currentVersion;

      // Проверяем, есть ли нужный файл в релизе
      const info = this.getPlatformInfo();
      const assetExists = latest.assets.some(
        (a) => a.name === info.githubExeName,
      );

      if (!assetExists) {
        console.warn(`⚠️ Файл ${info.githubExeName} не найден в релизе`);
        return {
          hasUpdate: false,
          current: currentVersion,
          latest: latest.version,
          useGst: useGst,
          error: "Файл с текущей настройкой GST не найден в релизе",
        };
      }

      return {
        hasUpdate,
        current: currentVersion,
        latest: latest.version,
        useGst: useGst,
      };
    } catch (error) {
      console.error("Ошибка проверки обновлений:", error);
      return {
        hasUpdate: false,
        message: error.message,
        useGst: store.get("tsUseGst", false),
      };
    }
  }

  // Обновление
  async update() {
    try {
      const check = await this.checkForUpdate();

      if (!check.hasUpdate) {
        return {
          success: false,
          message: "Уже установлена последняя версия",
          current: check.current,
          latest: check.latest,
          useGst: check.useGst,
        };
      }

      // Проверяем, есть ли файл с нужной настройкой GST в релизе
      const info = this.getPlatformInfo();
      const latest = await this.getLatestRelease();
      const assetExists = latest.assets.some(
        (a) => a.name === info.githubExeName,
      );

      if (!assetExists) {
        return {
          success: false,
          message: `Файл с настройкой GST (${info.useGst ? "включена" : "отключена"}) не найден в релизе`,
          useGst: info.useGst,
        };
      }

      const wasRunning = this.process !== null;
      if (wasRunning) {
        console.log("🛑 Останавливаем TorrServer перед обновлением...");
        await this.stop();
      }

      // Удаляем старый файл
      const savedPath = store.get("tsPath");
      const executablePath =
        savedPath && existsSync(savedPath) ? savedPath : info.savePath;

      if (existsSync(executablePath)) {
        await fs.unlink(executablePath);
        console.log(`🗑️ Удален старый файл: ${executablePath}`);
      }

      console.log(`📥 Скачиваем новую версию TorrServer ${check.latest}...`);
      const downloadResult = await this.download("latest");

      if (!downloadResult.success) {
        throw new Error(
          downloadResult.message || "Ошибка при скачивании обновления",
        );
      }

      // Запускаем, если был запущен
      if (downloadResult.success && wasRunning) {
        console.log("🚀 Запускаем обновленный TorrServer...");
        const startResult = await this.start();
        if (!startResult.success) {
          console.warn(
            "⚠️ Не удалось автоматически запустить TorrServer после обновления",
          );
          return {
            success: true,
            message:
              "TorrServer обновлен, но не удалось автоматически запустить",
            version: downloadResult.version,
            useGst: downloadResult.useGst,
            startError: startResult.message,
          };
        }
        return {
          success: true,
          message: "TorrServer успешно обновлен и запущен",
          version: downloadResult.version,
          useGst: downloadResult.useGst,
        };
      }

      return {
        success: true,
        message: "TorrServer успешно обновлен",
        version: downloadResult.version,
        useGst: downloadResult.useGst,
      };
    } catch (error) {
      console.error("❌ Ошибка обновления TorrServer:", error);
      return {
        success: false,
        message: error.message || "Ошибка при обновлении TorrServer",
        useGst: store.get("tsUseGst", false),
      };
    }
  }

  // Получение статуса
  getStatus() {
    const info = this.getPlatformInfo();
    const useGst = store.get("tsUseGst", false);

    // Проверяем установку по сохраненному пути или по стандартному пути
    const savedPath = store.get("tsPath");
    const executablePath =
      savedPath && existsSync(savedPath) ? savedPath : info.savePath;

    // Проверяем, существует ли файл
    const isInstalled =
      existsSync(executablePath) && store.get("tsVersion") !== null;

    return {
      status: this.status,
      running: this.process !== null,
      pid: this.process?.pid || null,
      version: store.get("tsVersion") || null,
      path: executablePath || null,
      host: "localhost",
      port: store.get("tsPort") || 8090,
      dataDir: info.dataDir,
      executableDir: info.saveDir,
      installed: isInstalled,
      useGst: useGst,
      gstSupported: this.gstSupport,
      serverVersion: this.version,
      // Добавляем информацию о том, соответствует ли установленная версия настройке GST
      gstMismatch:
        isInstalled && store.get("tsGstEnabled") !== undefined
          ? store.get("tsGstEnabled") !== useGst
          : false,
    };
  }

  // Управление выводом
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

const torrServerManager = new TorrServerManager();
module.exports = torrServerManager;
