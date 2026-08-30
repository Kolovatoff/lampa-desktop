const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");

const SVG_PATH = path.join(__dirname, "../assets/icon.svg");
const BUILD_DIR = path.join(__dirname, "../build/icons");
const PROJECT_ROOT = path.join(__dirname, "..");

const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
/** Full-bleed brand background — macOS applies the squircle; do not leave transparent corners. */
const ICON_BG = "#1D1F20";
const ICON_BG_RGB = [0x1d, 0x1f, 0x20];

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveImageMagick() {
  for (const cmd of ["magick", "convert"]) {
    try {
      execSync(`which ${cmd}`, { stdio: "ignore" });
      return cmd;
    } catch {
      // try next
    }
  }
  return null;
}

function parsePng(filePath) {
  const data = fs.readFileSync(filePath);
  if (
    data
      .subarray(0, 8)
      .compare(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ) !== 0
  ) {
    throw new Error(`not a PNG: ${filePath}`);
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatParts = [];
  while (pos < data.length) {
    const length = data.readUInt32BE(pos);
    const type = data.toString("ascii", pos + 4, pos + 8);
    const chunk = data.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      colorType = chunk[9];
    } else if (type === "IDAT") {
      idatParts.push(chunk);
    } else if (type === "IEND") {
      break;
    }
  }
  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!bpp) throw new Error(`unsupported PNG colorType ${colorType}`);
  const stride = width * bpp;
  let i = 0;
  let prev = Buffer.alloc(stride);
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ft = raw[i++];
    const row = Buffer.from(raw.subarray(i, i + stride));
    i += stride;
    if (ft === 1) {
      for (let x = bpp; x < stride; x++) row[x] = (row[x] + row[x - bpp]) & 255;
    } else if (ft === 2) {
      for (let x = 0; x < stride; x++) row[x] = (row[x] + prev[x]) & 255;
    } else if (ft === 3) {
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? row[x - bpp] : 0;
        row[x] = (row[x] + ((a + prev[x]) >> 1)) & 255;
      }
    } else if (ft === 4) {
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? row[x - bpp] : 0;
        const b = prev[x];
        const c = x >= bpp ? prev[x - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        row[x] = (row[x] + pr) & 255;
      }
    }
    for (let x = 0; x < width; x++) {
      const o = x * bpp;
      const out = (y * width + x) * 4;
      if (bpp === 4) {
        pixels[out] = row[o];
        pixels[out + 1] = row[o + 1];
        pixels[out + 2] = row[o + 2];
        pixels[out + 3] = row[o + 3];
      } else if (bpp === 3) {
        pixels[out] = row[o];
        pixels[out + 1] = row[o + 1];
        pixels[out + 2] = row[o + 2];
        pixels[out + 3] = 255;
      } else {
        pixels[out] = pixels[out + 1] = pixels[out + 2] = row[o];
        pixels[out + 3] = 255;
      }
    }
    prev = row;
  }
  return { width, height, pixels };
}

function flattenOntoBg(pixels) {
  const [br, bg, bb] = ICON_BG_RGB;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a === 255) continue;
    if (a === 0) {
      pixels[i] = br;
      pixels[i + 1] = bg;
      pixels[i + 2] = bb;
      pixels[i + 3] = 255;
      continue;
    }
    const af = a / 255;
    pixels[i] = Math.round(pixels[i] * af + br * (1 - af));
    pixels[i + 1] = Math.round(pixels[i + 1] * af + bg * (1 - af));
    pixels[i + 2] = Math.round(pixels[i + 2] * af + bb * (1 - af));
    pixels[i + 3] = 255;
  }
}

function resizeNearest(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

function writePngRgba(filePath, width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, body])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  fs.writeFileSync(
    filePath,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", compressed),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

/** Rasterize SVG → opaque NxN PNGs (no transparent corners → no white Dock frame). */
function generatePNGs() {
  console.log("📸 Генерация PNG иконок...");
  const pngDir = path.join(BUILD_DIR, "png");
  ensureDirectoryExists(pngDir);

  const masterPath = path.join(pngDir, "1024x1024.png");
  const im = resolveImageMagick();

  if (im) {
    const prefix = im === "magick" ? "magick" : "convert";
    // Render full SVG viewBox once (per-size SVG -resize crops/zooms incorrectly in IM).
    // density keeps the 1500×1500 canvas framed; flatten onto brand bg for opaque edges.
    execSync(
      `${prefix} -density 144 -background '${ICON_BG}' "${SVG_PATH}" ` +
        `-resize 1024x1024 -gravity center -background '${ICON_BG}' -extent 1024x1024 ` +
        `-alpha on -background '${ICON_BG}' -alpha background -depth 8 -strip "PNG32:${masterPath}"`,
      { stdio: "inherit" },
    );
    assertMasterLooksLikeLogo(masterPath);
    console.log("✅ PNG master: 1024x1024");

    for (const size of PNG_SIZES) {
      if (size === 1024) continue;
      const pngPath = path.join(pngDir, `${size}x${size}.png`);
      execSync(
        `${prefix} "${masterPath}" -resize ${size}x${size}! ` +
          `-alpha on -background '${ICON_BG}' -alpha background -depth 8 -strip "PNG32:${pngPath}"`,
        { stdio: "inherit" },
      );
      console.log(`✅ PNG: ${size}x${size}`);
    }
    return pngDir;
  }

  console.log(
    "⚠️ ImageMagick не найден — растр через qlmanage/sips + Node flatten",
  );
  generatePNGsWithMacTools(pngDir);
  assertMasterLooksLikeLogo(path.join(pngDir, "1024x1024.png"));
  return pngDir;
}

/** Guard against broken SVG raster (solid fill / extreme crop). */
function assertMasterLooksLikeLogo(pngPath) {
  const { width, height, pixels } = parsePng(pngPath);
  let white = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) white++;
  }
  const ratio = white / (width * height);
  // Full lamp mark is roughly 25–45% white; solid/crop failures are ~0% or >55%.
  if (ratio < 0.15 || ratio > 0.55) {
    throw new Error(
      `bad master icon: white_ratio=${ratio.toFixed(3)} white=${white} size=${width}x${height}`,
    );
  }
  console.log(`✅ master ok: white_ratio=${ratio.toFixed(3)}`);
}

function generatePNGsWithMacTools(pngDir) {
  const tmpDir = path.join(BUILD_DIR, ".tmp-raster");
  ensureDirectoryExists(tmpDir);

  execSync(`qlmanage -t -s 1024 -o "${tmpDir}" "${SVG_PATH}"`, {
    stdio: "inherit",
  });
  const rendered = path.join(tmpDir, `${path.basename(SVG_PATH)}.png`);
  if (!fs.existsSync(rendered)) {
    throw new Error(`qlmanage не создал превью: ${rendered}`);
  }

  const master1024 = path.join(tmpDir, "master-1024.png");
  execSync(`sips -z 1024 1024 "${rendered}" --out "${master1024}"`, {
    stdio: "inherit",
  });

  const { width, height, pixels } = parsePng(master1024);
  flattenOntoBg(pixels);
  writePngRgba(path.join(pngDir, "1024x1024.png"), width, height, pixels);
  console.log("✅ PNG: 1024x1024");

  for (const size of PNG_SIZES) {
    if (size === 1024) continue;
    const scaled = resizeNearest(pixels, width, height, size, size);
    writePngRgba(path.join(pngDir, `${size}x${size}.png`), size, size, scaled);
    console.log(`✅ PNG: ${size}x${size}`);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function createIco(pngDir) {
  console.log("🪟 Создание ICO для Windows...");
  const winDir = path.join(BUILD_DIR, "win");
  ensureDirectoryExists(winDir);
  const icoPath = path.join(winDir, "icon.ico");

  const im = resolveImageMagick();
  if (!im) {
    console.warn(
      "⚠️ ImageMagick не найден — пропуск ICO (нужен для Windows-сборки)",
    );
    return;
  }

  try {
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngFiles = sizes
      .map((s) => path.join(pngDir, `${s}x${s}.png`))
      .join(" ");
    const prefix = im === "magick" ? "magick" : "convert";
    execSync(
      `${prefix} ${pngFiles} -colors 256 -background '${ICON_BG}' "${icoPath}"`,
      {
        stdio: "inherit",
      },
    );
    console.log(`✅ ICO создан: ${icoPath}`);
  } catch (error) {
    console.error("❌ Ошибка создания ICO:", error.message);
  }
}

function isIconutilAvailable() {
  try {
    execSync("which iconutil", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function createIcnsWithIconutil(pngDir) {
  console.log("🍎 Создание ICNS через iconutil...");
  const macDir = path.join(BUILD_DIR, "mac");
  ensureDirectoryExists(macDir);
  const icnsPath = path.join(macDir, "icon.icns");

  try {
    const iconsetDir = path.join(macDir, "icon.iconset");
    fs.rmSync(iconsetDir, { recursive: true, force: true });
    ensureDirectoryExists(iconsetDir);

    const iconSizes = [
      { size: 16, name: "icon_16x16.png" },
      { size: 32, name: "icon_16x16@2x.png" },
      { size: 32, name: "icon_32x32.png" },
      { size: 64, name: "icon_32x32@2x.png" },
      { size: 128, name: "icon_128x128.png" },
      { size: 256, name: "icon_128x128@2x.png" },
      { size: 256, name: "icon_256x256.png" },
      { size: 512, name: "icon_256x256@2x.png" },
      { size: 512, name: "icon_512x512.png" },
      { size: 1024, name: "icon_512x512@2x.png" },
    ];

    const im = resolveImageMagick();
    for (const { size, name } of iconSizes) {
      const src = path.join(pngDir, `${size}x${size}.png`);
      const dst = path.join(iconsetDir, name);
      if (!fs.existsSync(src)) {
        continue;
      }
      // iconutil expects 8-bit PNG with alpha channel.
      if (im) {
        const prefix = im === "magick" ? "magick" : "convert";
        execSync(
          `${prefix} "${src}" -alpha on -background '${ICON_BG}' -alpha background -depth 8 -strip "PNG32:${dst}"`,
          { stdio: "inherit" },
        );
      } else {
        fs.copyFileSync(src, dst);
      }
    }

    execSync(`iconutil -c icns -o "${icnsPath}" "${iconsetDir}"`, {
      stdio: "inherit",
    });
    console.log(`✅ ICNS создан: ${icnsPath}`);

    fs.rmSync(iconsetDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error("❌ Ошибка создания ICNS через iconutil:", error.message);
    fs.rmSync(path.join(macDir, "icon.iconset"), {
      recursive: true,
      force: true,
    });
    return false;
  }
}

/** Write a valid ICNS from PNG sizes when iconutil is unavailable. */
function createIcnsWithPngPack(pngDir) {
  console.log("🍎 Создание ICNS через PNG-pack (fallback)...");
  const macDir = path.join(BUILD_DIR, "mac");
  ensureDirectoryExists(macDir);
  const icnsPath = path.join(macDir, "icon.icns");

  // Apple icon types that accept PNG payloads.
  const entries = [
    { type: "icp4", size: 16 },
    { type: "icp5", size: 32 },
    { type: "icp6", size: 64 },
    { type: "ic07", size: 128 },
    { type: "ic08", size: 256 },
    { type: "ic09", size: 512 },
    { type: "ic10", size: 1024 },
    { type: "ic11", size: 32 },
    { type: "ic12", size: 64 },
    { type: "ic13", size: 256 },
    { type: "ic14", size: 512 },
  ];

  try {
    const chunks = [];
    for (const { type, size } of entries) {
      const pngPath = path.join(pngDir, `${size}x${size}.png`);
      if (!fs.existsSync(pngPath)) {
        continue;
      }
      const png = fs.readFileSync(pngPath);
      const len = 8 + png.length;
      const header = Buffer.alloc(8);
      header.write(type, 0, 4, "ascii");
      header.writeUInt32BE(len, 4);
      chunks.push(Buffer.concat([header, png]));
    }
    if (chunks.length === 0) {
      return false;
    }
    const body = Buffer.concat(chunks);
    const fileHeader = Buffer.alloc(8);
    fileHeader.write("icns", 0, 4, "ascii");
    fileHeader.writeUInt32BE(8 + body.length, 4);
    fs.writeFileSync(icnsPath, Buffer.concat([fileHeader, body]));
    console.log(`✅ ICNS создан: ${icnsPath}`);
    return true;
  } catch (error) {
    console.error("❌ Ошибка PNG-pack ICNS:", error.message);
    return false;
  }
}

function createIcns(pngDir) {
  console.log("🍎 Создание ICNS для macOS...");

  if (isIconutilAvailable()) {
    console.log("✅ Найден iconutil, использую стандартную утилиту macOS");
    if (createIcnsWithIconutil(pngDir)) {
      return;
    }
  }

  console.log("⚠️ Fallback: PNG-pack ICNS");
  if (!createIcnsWithPngPack(pngDir)) {
    console.error("❌ Не удалось создать ICNS");
    process.exitCode = 1;
  }
}

function createLinuxIcons(pngDir) {
  console.log("🐧 Подготовка иконок для Linux...");
  const linuxDir = path.join(BUILD_DIR, "linux");
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
  console.log("📁 Создание fallback иконок для Linux...");

  const fallbackDir = path.join(PROJECT_ROOT, "build");
  ensureDirectoryExists(fallbackDir);

  const src256 = path.join(pngDir, "256x256.png");
  const dst256 = path.join(fallbackDir, "icon.png");
  if (fs.existsSync(src256)) {
    fs.copyFileSync(src256, dst256);
    console.log(`✅ Fallback иконка создана: ${dst256}`);
  }

  if (fs.existsSync(SVG_PATH)) {
    const dstSvg = path.join(fallbackDir, "icon.svg");
    fs.copyFileSync(SVG_PATH, dstSvg);
    console.log(`✅ SVG иконка скопирована в build: ${dstSvg}`);
  }
}

function generateAllIcons() {
  console.log("🚀 Начинаем генерацию иконок...");

  if (!fs.existsSync(SVG_PATH)) {
    console.error(`❌ SVG файл не найден: ${SVG_PATH}`);
    process.exit(1);
  }

  const pngDir = generatePNGs();
  createIco(pngDir);
  createIcns(pngDir);
  createLinuxIcons(pngDir);
  createFallbackIcons(pngDir);

  console.log("✅ Все иконки успешно сгенерированы!");
  console.log("📁 Структура иконок:");
  console.log(`   - PNG: ${path.join(BUILD_DIR, "png")}`);
  console.log(`   - Windows ICO: ${path.join(BUILD_DIR, "win")}`);
  console.log(`   - macOS ICNS: ${path.join(BUILD_DIR, "mac")}`);
  console.log(`   - Linux: ${path.join(BUILD_DIR, "linux")}`);
  console.log(`   - Fallback: ${path.join(PROJECT_ROOT, "build")}`);
}

if (require.main === module) {
  generateAllIcons();
}

module.exports = { generateAllIcons };
