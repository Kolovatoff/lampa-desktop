const { ipcMain } = require("electron");
const { existsSync } = require("fs");
const { spawn } = require("child_process");
const which = require("which");

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
        new Error(`Command ${cmd} not found: ${err.message}`),
      );
    }
  });
}

module.exports = registerProcessHandlers;
