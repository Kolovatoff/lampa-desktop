const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SVG_PATH = path.join(__dirname, '../assets/icon.svg');
const BUILD_DIR = path.join(__dirname, '../build/icons');
const PROJECT_ROOT = path.join(__dirname, '..');

const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generatePNGs() {
  console.log('📸 Генерация PNG иконок...');
  const pngDir = path.join(BUILD_DIR, 'png');
  ensureDirectoryExists(pngDir);

  for (const size of PNG_SIZES) {
    const pngPath = path.join(pngDir, `${size}x${size}.png`);
    try {
      execSync(`convert -background none -resize ${size}x${size} "${SVG_PATH}" "${pngPath}"`, {
        stdio: 'inherit'
      });
      console.log(`✅ PNG: ${size}x${size}`);
    } catch (error) {
      console.error(`❌ Ошибка PNG ${size}x${size}:`, error.message);
    }
  }
  return pngDir;
}

function createIco(pngDir) {
  console.log('🪟 Создание ICO для Windows...');
  const winDir = path.join(BUILD_DIR, 'win');
  ensureDirectoryExists(winDir);
  const icoPath = path.join(winDir, 'icon.ico');

  try {
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngFiles = sizes.map(s => path.join(pngDir, `${s}x${s}.png`)).join(' ');
    execSync(`convert ${pngFiles} -colors 256 -background transparent ${icoPath}`, {
      stdio: 'inherit'
    });
    console.log(`✅ ICO создан: ${icoPath}`);
  } catch (error) {
    console.error('❌ Ошибка создания ICO:', error.message);
  }
}

function isIconutilAvailable() {
  try {
    execSync('which iconutil', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function createIcnsWithIconutil(pngDir) {
  console.log('🍎 Создание ICNS через iconutil...');
  const macDir = path.join(BUILD_DIR, 'mac');
  ensureDirectoryExists(macDir);
  const icnsPath = path.join(macDir, 'icon.icns');

  try {
    const iconsetDir = path.join(macDir, 'icon.iconset');
    ensureDirectoryExists(iconsetDir);

    const iconSizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' }
    ];

    for (const { size, name } of iconSizes) {
      const src = path.join(pngDir, `${size}x${size}.png`);
      const dst = path.join(iconsetDir, name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
    }

    execSync(`iconutil -c icns -o "${icnsPath}" "${iconsetDir}"`, {
      stdio: 'inherit'
    });
    console.log(`✅ ICNS создан: ${icnsPath}`);

    fs.rmSync(iconsetDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error('❌ Ошибка создания ICNS через iconutil:', error.message);
    fs.rmSync(path.join(macDir, 'icon.iconset'), { recursive: true, force: true });
    return false;
  }
}

function createIcnsWithImageMagick(pngDir) {
  console.log('🍎 Создание ICNS через ImageMagick...');
  const macDir = path.join(BUILD_DIR, 'mac');
  ensureDirectoryExists(macDir);
  const icnsPath = path.join(macDir, 'icon.icns');

  try {
    const iconsetDir = path.join(macDir, 'icon.iconset');
    ensureDirectoryExists(iconsetDir);

    const sizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' }
    ];

    for (const { size, name } of sizes) {
      const src = path.join(pngDir, `${size}x${size}.png`);
      const dst = path.join(iconsetDir, name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
      }
    }

    execSync(`convert "${iconsetDir}"/*.png "${icnsPath}"`, {
      stdio: 'inherit'
    });
    console.log(`✅ ICNS создан через ImageMagick: ${icnsPath}`);
    
    fs.rmSync(iconsetDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error('❌ Ошибка создания ICNS через ImageMagick:', error.message);
    fs.rmSync(path.join(macDir, 'icon.iconset'), { recursive: true, force: true });
    return false;
  }
}

function createIcns(pngDir) {
  console.log('🍎 Создание ICNS для macOS...');
  
  if (isIconutilAvailable()) {
    console.log('✅ Найден iconutil, использую стандартную утилиту macOS');
    if (createIcnsWithIconutil(pngDir)) {
      return;
    }
  }

  console.log('⚠️ Пробую ImageMagick...');
  if (!createIcnsWithImageMagick(pngDir)) {
    console.error('❌ Не удалось создать ICNS');
  }
}

function createLinuxIcons(pngDir) {
  console.log('🐧 Подготовка иконок для Linux...');
  const linuxDir = path.join(BUILD_DIR, 'linux');
  ensureDirectoryExists(linuxDir);

  const linuxSizes = [16, 24, 32, 48, 64, 128, 256, 512];
  for (const size of linuxSizes) {
    const src = path.join(pngDir, `${size}x${size}.png`);
    const dst = path.join(linuxDir, `${size}x${size}.png`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`✅ Linux: ${size}x${size}`);
    }
  }
}

function createFallbackIcons(pngDir) {
  console.log('📁 Создание fallback иконок для Linux...');
  
  const fallbackDir = path.join(PROJECT_ROOT, 'build');
  ensureDirectoryExists(fallbackDir);
  
  const src256 = path.join(pngDir, '256x256.png');
  const dst256 = path.join(fallbackDir, 'icon.png');
  if (fs.existsSync(src256)) {
    fs.copyFileSync(src256, dst256);
    console.log(`✅ Fallback иконка создана: ${dst256}`);
  }
  
  if (fs.existsSync(SVG_PATH)) {
    const dstSvg = path.join(fallbackDir, 'icon.svg');
    fs.copyFileSync(SVG_PATH, dstSvg);
    console.log(`✅ SVG иконка скопирована в build: ${dstSvg}`);
  }
}

function generateAllIcons() {
  console.log('🚀 Начинаем генерацию иконок...');

  if (!fs.existsSync(SVG_PATH)) {
    console.error(`❌ SVG файл не найден: ${SVG_PATH}`);
    process.exit(1);
  }

  const pngDir = generatePNGs();
  createIco(pngDir);
  createIcns(pngDir);
  createLinuxIcons(pngDir);
  createFallbackIcons(pngDir);

  console.log('✅ Все иконки успешно сгенерированы!');
  console.log('📁 Структура иконок:');
  console.log(`   - PNG: ${path.join(BUILD_DIR, 'png')}`);
  console.log(`   - Windows ICO: ${path.join(BUILD_DIR, 'win')}`);
  console.log(`   - macOS ICNS: ${path.join(BUILD_DIR, 'mac')}`);
  console.log(`   - Linux: ${path.join(BUILD_DIR, 'linux')}`);
  console.log(`   - Fallback: ${path.join(PROJECT_ROOT, 'build')}`);
}

if (require.main === module) {
  generateAllIcons();
}

module.exports = { generateAllIcons };