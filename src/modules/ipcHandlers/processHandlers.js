const { ipcMain } = require("electron");
const { existsSync } = require("fs");
const { spawn } = require("child_process");
const which = require("which");
const path = require("path");

const WHITELIST = {
  // Имена команд без расширения (кросс-платформенные)
  commands: new Set([
    "vlc",
    "kmplayer",
    "kmplayer64",
    "potplayer",
    "potplayermini",
    "potplayermini64",
    "mpv",
    "smplayer",
    "kodi",
    "gom",
    "gom64",
    "mpc-hc",
    "mpc-hc64",
    "mpc-be",
    "mpc-be64",
    "quicktime player",
    "wmplayer",
    "iina",
    "elmedia player",
    "movist",
    "infuse",
    "celluloid",
    "haruna",
    "dragon",
    "parole",
    "5kplayer",
    "zplayer",
  ]),

  // Конкретные пути к файлам (можно указывать с расширением или без)
  paths: new Set([]),

  // Директории, из которых разрешен запуск любых файлов
  allowedDirectories: new Set([]),
};

function normalizePath(filePath) {
  if (!filePath) return filePath;
  return path.normalize(filePath).toLowerCase();
}

function getFileNameWithoutExtension(filePath) {
  if (!filePath) return null;
  const basename = path.basename(filePath);
  return path.parse(basename).name.toLowerCase();
}

function isInAllowedDirectory(filePath) {
  if (!filePath) return false;

  const normalizedFilePath = normalizePath(filePath);

  for (const dir of WHITELIST.allowedDirectories) {
    const normalizedDir = normalizePath(dir);
    if (normalizedFilePath.startsWith(normalizedDir)) {
      return true;
    }
  }
  return false;
}

function isCommandAllowed(cmd, resolvedPath) {
  if (!resolvedPath) return false;

  const cmdWithoutExt = getFileNameWithoutExtension(cmd);
  if (cmdWithoutExt && WHITELIST.commands.has(cmdWithoutExt)) {
    return true;
  }

  const normalizedResolvedPath = normalizePath(resolvedPath);
  for (const allowedPath of WHITELIST.paths) {
    if (normalizedResolvedPath === normalizePath(allowedPath)) {
      return true;
    }
  }

  return isInAllowedDirectory(resolvedPath);
}

function registerProcessHandlers() {
  ipcMain.on("fs-existsSync", async (event, filePath) => {
    try {
      const resolvedPath = await which(filePath, { path: process.env.PATH });
      event.returnValue = existsSync(resolvedPath);
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.on("child-process-spawn", async (event, id, cmd, args, opts) => {
    try {
      const resolvedCmd = await which(cmd, {
        path: opts?.env?.PATH || process.env.PATH,
      });

      if (!isCommandAllowed(cmd, resolvedCmd)) {
        throw new Error(
          `Command "${cmd}" (resolved to "${resolvedCmd}") is not allowed by whitelist`,
        );
      }

      const spawnOptions = opts || {};
      spawnOptions.env = { ...process.env, ...(opts?.env || {}) };
      const child = spawn(resolvedCmd, args, spawnOptions);

      child.on("error", (err) => {
        event.sender.send(`child-process-spawn-error-${id}`, err);
      });

      child.on("exit", (code) => {
        event.sender.send(`child-process-spawn-exit-${id}`, code);
      });

      child.stdout.on("data", (data) => {
        event.sender.send(`child-process-spawn-stdout-${id}`, data);
      });

      child.stderr.on("data", (data) => {
        event.sender.send(`child-process-spawn-stderr-${id}`, data);
      });
    } catch (err) {
      event.sender.send(
        `child-process-spawn-error-${id}`,
        new Error(`Command ${cmd} not allowed: ${err.message}`),
      );
    }
  });
}

module.exports = registerProcessHandlers;
