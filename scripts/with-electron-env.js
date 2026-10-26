#!/usr/bin/env node
// scripts/with-electron-env.js
// Запускает команду с переменными окружения для Electron.
// Использование: node scripts/with-electron-env.js electron .

const { spawn } = require('child_process');

// --- Формируем env ---
const env = {
  ...process.env,
  ELECTRON_MIRROR: 'https://lampa.kolovatoff.ru/electron/',
  electron_use_remote_checksums: '1',
  // ELECTRON_UNSAFELY_DISABLE_CHECKSUMS: '1',
};

// --- Запускаем команду ---
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Укажите команду, например: node scripts/with-electron-env.js electron .');
  process.exit(1);
}

console.log(`[with-electron-env] ELECTRON_MIRROR=${env.ELECTRON_MIRROR}`);
console.log(`[with-electron-env] electron_use_remote_checksums=${env.electron_use_remote_checksums}`);

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

child.on('error', (err) => {
  console.error('Не удалось запустить команду:', err);
  process.exit(1);
});