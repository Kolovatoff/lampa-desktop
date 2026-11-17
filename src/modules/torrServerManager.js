// modules/torrServerManager.js
const { app } = require("electron");
const { spawn } = require("child_process");
const path = require("node:path");
const fs = require("node:fs").promises;
const { existsSync } = require("node:fs");
const https = require("node:https");
const { createWriteStream } = require("node:fs");
const store = require("./storeManager");

// Конфигурация
const GITHUB_RELEASES_API =
  "https://api.github.com/repos/YouROK/TorrServer/releases?per_page=10";

// Сколько страниц максимум просматривать при поиске MatriX-релиза
const MAX_RELEASE_PAGES = 5;

class TorrServerManager {
  constructor() {
    this.process = null;
    this.status = "stopped";
    this.currentVersion = null;
    this.executablePath = null;
    this.outputListeners = [];
    this.gstSupport = null;
    this.version = null;
    // Прогресс текущей загрузки (null, если загрузки нет)
    this.downloadProgress = null;
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
    // Временный файл, в который идёт скачивание. Переименовывается в savePath
    // только после успешного завершения загрузки.
    const downloadPath = `${savePath}.download`;
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
      downloadPath,
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

      // Удаляем «осиротевший» временный файл, если он остался с прошлого раза
      try {
        if (existsSync(info.downloadPath)) {
          await fs.unlink(info.downloadPath);
          console.log(`🧹 Удален незавершённый файл: ${info.downloadPath}`);
        }
      } catch (cleanupError) {
        console.warn(
          "⚠️ Не удалось удалить незавершённый файл:",
          cleanupError.message,
        );
      }

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

  // Проверка, что релиз относится к проекту MatriX
  isMatrixRelease(release) {
    if (!release) return false;
    const tag = (release.tag_name || "").toString();
    const name = (release.name || "").toString();
    return tag.includes("MatriX") || name.includes("MatriX");
  }

  // Получение последнего релиза MatriX (перебор релизов, игнорируя Silo и прочее)
  async getLatestMatrixRelease() {
    try {
      let page = 1;
      while (page <= MAX_RELEASE_PAGES) {
        const url = `${GITHUB_RELEASES_API}&page=${page}`;
        const response = await fetch(url, {
          headers: { "User-Agent": "Electron-App" },
        });

        if (!response.ok) {
          throw new Error(`GitHub API HTTP ${response.status}`);
        }

        const releases = await response.json();
        if (!Array.isArray(releases) || releases.length === 0) {
          break;
        }

        const matrixRelease = releases.find((r) => this.isMatrixRelease(r));
        if (matrixRelease) {
          this.currentVersion = matrixRelease.tag_name;
          console.log(
            `✅ Найден MatriX-релиз: ${matrixRelease.tag_name} (${matrixRelease.name || "без имени"})`,
          );
          return {
            version: matrixRelease.tag_name,
            name: matrixRelease.name || null,
            assets: matrixRelease.assets || [],
          };
        }

        // Если на странице меньше per_page — дальше страниц нет
        if (releases.length < 10) break;
        page += 1;
      }

      throw new Error("Не найден релиз с MatriX в названии");
    } catch (error) {
      console.error("Ошибка получения MatriX-релиза:", error);
      throw error;
    }
  }

  // Обратная совместимость: раньше метод назывался getLatestRelease.
  // Теперь он возвращает именно MatriX-релиз.
  async getLatestRelease() {
    return this.getLatestMatrixRelease();
  }

  // Скачивание файла с прогрессом
  downloadFileWithProgress(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          // Обработка редиректов (GitHub отдаёт 301/302)
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location;
            if (!location) {
              reject(new Error("Редирект без Location"));
              return;
            }
            res.resume(); // освобождаем поток
            this.downloadFileWithProgress(location, destPath, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }

          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          const total = parseInt(res.headers["content-length"], 10) || 0;
          let received = 0;
          let lastPercent = -1;

          const fileStream = createWriteStream(destPath);

          res.on("data", (chunk) => {
            received += chunk.length;
            fileStream.write(chunk);

            if (onProgress) {
              const percent =
                total > 0 ? Math.floor((received / total) * 100) : null;
              // Не спамим одинаковыми процентами
              if (percent === null || percent !== lastPercent) {
                lastPercent = percent;
                onProgress({ received, total, percent });
              }
            }
          });

          res.on("end", () => {
            fileStream.end();
          });

          fileStream.on("finish", () => {
            if (onProgress) {
              onProgress({
                received,
                total: total || received,
                percent: 100,
              });
            }
            resolve({ received, total: total || received });
          });

          fileStream.on("error", (err) => {
            reject(err);
          });

          res.on("error", (err) => {
            reject(err);
          });
        })
        .on("error", reject);
    });
  }

  // Загрузка TorrServer
  async download(version = "latest") {
    const info = this.getPlatformInfo();

    try {
      // Сначала создаем все необходимые папки
      await this.ensureDirectories();

      // Получаем информацию о последнем MatriX-релизе
      const release = await this.getLatestMatrixRelease();
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

      // Инициализируем прогресс
      this.downloadProgress = {
        received: 0,
        total: 0,
        percent: 0,
        file: info.localExeName,
        version: targetVersion,
        startedAt: Date.now(),
      };

      // Скачиваем во временный файл
      try {
        await this.downloadFileWithProgress(
          downloadUrl,
          info.downloadPath,
          (progress) => {
            this.downloadProgress = {
              ...this.downloadProgress,
              ...progress,
            };
            this.notifyListeners("download-progress", {
              ...progress,
              file: info.localExeName,
              version: targetVersion,
            });
          },
        );

        // Проверяем, что файл действительно скачался и не пустой
        const stat = await fs.stat(info.downloadPath);
        if (!stat.size) {
          throw new Error("Скачанный файл пуст");
        }

        // Для Linux/Mac делаем временный файл исполняемым до переименования
        if (info.platform !== "win32") {
          await fs.chmod(info.downloadPath, 0o755);
        }

        // Атомарно заменяем итоговый файл
        await fs.rename(info.downloadPath, info.savePath);
      } catch (downloadError) {
        // При ошибке удаляем временный файл, чтобы не оставлять мусор
        try {
          if (existsSync(info.downloadPath)) {
            await fs.unlink(info.downloadPath);
          }
        } catch (cleanupError) {
          console.warn(
            "⚠️ Не удалось удалить временный файл:",
            cleanupError.message,
          );
        }
        throw downloadError;
      }

      // Сохраняем информацию о версии и настройках
      store.set("tsVersion", targetVersion);
      store.set("tsPath", info.savePath);
      store.set("tsUseGst", info.useGst);
      store.set("tsGstEnabled", info.useGst);

      this.executablePath = info.savePath;

      // Сбрасываем прогресс
      this.downloadProgress = null;

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
      this.downloadProgress = null;
      console.error("❌ Ошибка загрузки TorrServer:", error);
      return { success: false, message: error.message };
    }
  }

  // Вспомогательный метод для скачивания с указанными настройками
  async downloadWithInfo(version, info) {
    try {
      await this.ensureDirectories();

      const release = await this.getLatestMatrixRelease();
      const targetVersion = version === "latest" ? release.version : version;

      const asset = release.assets.find((a) => a.name === info.githubExeName);
      if (!asset) {
        throw new Error(`Не найден файл ${info.githubExeName} в релизе`);
      }

      const downloadUrl = `https://github.com/YouROK/TorrServer/releases/download/${targetVersion}/${info.githubExeName}`;

      this.downloadProgress = {
        received: 0,
        total: 0,
        percent: 0,
        file: info.localExeName,
        version: targetVersion,
        startedAt: Date.now(),
      };

      try {
        await this.downloadFileWithProgress(
          downloadUrl,
          info.downloadPath,
          (progress) => {
            this.downloadProgress = {
              ...this.downloadProgress,
              ...progress,
            };
            this.notifyListeners("download-progress", {
              ...progress,
              file: info.localExeName,
              version: targetVersion,
            });
          },
        );

        const stat = await fs.stat(info.downloadPath);
        if (!stat.size) {
          throw new Error("Скачанный файл пуст");
        }

        if (info.platform !== "win32") {
          await fs.chmod(info.downloadPath, 0o755);
        }

        await fs.rename(info.downloadPath, info.savePath);
      } catch (downloadError) {
        try {
          if (existsSync(info.downloadPath)) {
            await fs.unlink(info.downloadPath);
          }
        } catch (cleanupError) {
          console.warn(
            "⚠️ Не удалось удалить временный файл:",
            cleanupError.message,
          );
        }
        throw downloadError;
      }

      store.set("tsVersion", targetVersion);
      store.set("tsPath", info.savePath);
      store.set("tsUseGst", info.useGst);
      store.set("tsGstEnabled", info.useGst);

      this.executablePath = info.savePath;
      this.downloadProgress = null;

      return {
        success: true,
        path: info.savePath,
        version: targetVersion,
        useGst: info.useGst,
      };
    } catch (error) {
      this.downloadProgress = null;
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
      const allWorks = data.gst_discoverer?.works && data.gstreamer?.works;
      // data.hdr_tone_mapping?.works &&
      // data.embedded_runtime?.works;

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

      // Создание папки перед каждым запуском (и очистка .download)
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

    // Удаляем старый файл (требуется для обратной совместимости)
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

      // Удаляем временный файл, если он есть
      if (existsSync(info.downloadPath)) {
        await fs.unlink(info.downloadPath);
        deletedItems.push(info.downloadPath);
        console.log(`🗑️ Удален временный файл: ${info.downloadPath}`);
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
      this.downloadProgress = null;

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
      const latest = await this.getLatestMatrixRelease();

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
      const latest = await this.getLatestMatrixRelease();
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
      // Прогресс текущей загрузки (null, если загрузки нет)
      downloadProgress: this.downloadProgress
        ? { ...this.downloadProgress }
        : null,
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