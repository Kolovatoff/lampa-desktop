// modules/vlcFinder.js
const { existsSync } = require("fs");
const path = require("path");

class VLCFinder {
  constructor() {
    this.foundPath = null;
  }

  // Поиск VLC на всех поддерживаемых ОС
  async findVLC() {
    console.log("🔍 Поиск VLC плеера...");

    const platform = process.platform;
    let foundPath = null;

    switch (platform) {
      case "win32":
        foundPath = this.findVLCWindows();
        break;
      case "darwin":
        foundPath = await this.findVLCMac();
        break;
      case "linux":
        foundPath = await this.findVLCLinux();
        break;
      default:
        console.error(`❌ Неподдерживаемая платформа: ${platform}`);
        return null;
    }

    if (foundPath) {
      console.log(`✅ VLC найден: ${foundPath}`);
      this.foundPath = foundPath;
    } else {
      console.log("❌ VLC не найден");
    }

    return foundPath;
  }

  // Поиск VLC на Windows
  findVLCWindows() {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 =
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

    const possiblePaths = [
      path.join(programFiles, "VideoLAN", "VLC", "vlc.exe"),
      path.join(programFilesX86, "VideoLAN", "VLC", "vlc.exe"),
      "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
      "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
    ];

    for (const vlcPath of possiblePaths) {
      if (existsSync(vlcPath)) {
        return vlcPath;
      }
    }

    return null;
  }

  // Поиск VLC на macOS
  async findVLCMac() {
    const standardPath = "/Applications/VLC.app/Contents/MacOS/VLC";
    if (existsSync(standardPath)) {
      return standardPath;
    }
  }

  // Поиск VLC на Linux
  async findVLCLinux() {
    const standardPaths = [
      "/usr/bin/vlc",
      "/usr/local/bin/vlc",
      "/snap/bin/vlc",
    ];

    for (const vlcPath of standardPaths) {
      if (existsSync(vlcPath)) {
        return vlcPath;
      }
    }

    return null;
  }

  // Получить путь к VLC
  async getVLCPath() {
    if (this.foundPath) {
      return this.foundPath;
    }
    return await this.findVLC();
  }

  // Проверить путь в localStorage
  async checkLocalStoragePath(mainWindow) {
    try {
      return await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('player_nw_path');
      `);
    } catch (error) {
      console.error("❌ Ошибка чтения player_nw_path:", error);
      return null;
    }
  }

  // Сохранить путь в localStorage Lampa
  async saveToLocalStorage(mainWindow, vlcPath) {
    if (!vlcPath) {
      vlcPath = await this.getVLCPath();
    }

    if (!vlcPath) {
      return false;
    }

    try {
      // Для Windows экранируем обратные слеши
      const escapedPath = vlcPath.replace(/\\/g, "\\\\");

      await mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('player_nw_path', '${escapedPath}');
        console.log('App', '✅ player_nw_path сохранен:', '${escapedPath}');
        console.log('App', '✅ player_torrent сохранен:', 'other');

        // Обновляем и Lampa.Storage если доступно
        if (window.Lampa && window.Lampa.Storage) {
          window.Lampa.Storage.set('player_nw_path', '${escapedPath}');
          window.Lampa.Storage.set('player_torrent', 'other');
        }
      `);

      console.log(`✅ Путь к VLC сохранен в localStorage: ${vlcPath}`);
      return true;
    } catch (error) {
      console.error("❌ Ошибка сохранения пути:", error);
      return false;
    }
  }

  // Диалог выбора VLC
  async showManualSelectDialog(mainWindow) {
    const { dialog } = require("electron");

    const filters =
      process.platform === "win32"
        ? [{ name: "VLC Executable", extensions: ["exe"] }]
        : [{ name: "VLC", extensions: ["*"] }];

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Выберите VLC плеер",
      defaultPath:
        process.platform === "win32"
          ? "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"
          : "/usr/bin/vlc",
      filters: filters,
      properties: ["openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      if (existsSync(selectedPath)) {
        this.foundPath = selectedPath;
        return selectedPath;
      }
    }

    return null;
  }
}

module.exports = new VLCFinder();
