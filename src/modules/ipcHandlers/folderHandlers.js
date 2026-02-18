// modules/ipcHandlers/folderHandlers.js
const { ipcMain, shell } = require("electron");
const fs = require("fs").promises;
const { existsSync } = require("fs");

class FolderHandlers {
  constructor() {
    this.registerHandlers();
  }

  registerHandlers() {
    // Открыть папку в системном файловом менеджере
    ipcMain.handle("folder-open", async (event, folderPath) => {
      return await this.openFolder(folderPath);
    });
  }

  /**
   * Открыть папку в системном файловом менеджере
   */
  async openFolder(folderPath) {
    try {
      if (!folderPath) {
        return { success: false, error: "Путь не указан" };
      }

      if (!existsSync(folderPath)) {
        return { success: false, error: "Папка не существует" };
      }

      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return { success: false, error: "Указанный путь не является папкой" };
      }

      const result = await shell.openPath(folderPath);

      if (result === "") {
        console.log(`📂 Папка открыта: ${folderPath}`);
        return { success: true, path: folderPath };
      } else {
        return { success: false, error: result };
      }
    } catch (error) {
      console.error("❌ Ошибка открытия папки:", error);
      return { success: false, error: error.message };
    }
  }
}

const folderHandlers = new FolderHandlers();

module.exports = () => {
  return folderHandlers;
};
