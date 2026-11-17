const pkg = require("./package.json");

module.exports = {
  ...pkg.build,
  ...(pkg.files ? { files: pkg.files } : {}),

  artifactName: "lampa_${version}_${arch}.${ext}",

  linux: {
    ...pkg.build.linux,
    target: [
      { target: "deb", arch: ["x64", "arm64"] },
      { target: "rpm", arch: ["x64", "arm64"] },
      "AppImage",
    ],
    icon: "build/icons/linux",
    category: "AudioVideo;Video",
    desktop: {
      entry: {
        Name: "Lampa",
        Comment: "Десктопное приложение-клиент для Lampa",
        Categories: "AudioVideo;",
        StartupWMClass: "lampa-desktop",
        MimeType: "application/x-lampa",
      },
    },
    maintainer: "Kirill Kolovatov <kirill@kolovatov.ru>",
    vendor: "Kolovatoff",
    executableName: "lampa",
  },

  // Отдельные переопределения для deb и rpm
  deb: {
    artifactName: "lampa_${version}_${arch}.deb",
    // depends: [
    //   'libgtk-3-0',
    //   'libnotify4',
    //   'libnss3',
    //   'libxss1',
    //   'libxtst6',
    //   'xdg-utils',
    //   'libatspi2.0-0',
    //   'libsecret-1-0'
    // ]
  },

  rpm: {
    artifactName: "lampa-${version}.${arch}.rpm",
    // depends: [
    //   'gtk3',
    //   'libnotify',
    //   'nss',
    //   'libXScrnSaver',
    //   'libXtst',
    //   'xdg-utils',
    //   'at-spi2-core',
    //   'libsecret'
    // ]
  },

  appImage: {
    artifactName: "lampa-${version}-${arch}.AppImage",
  },
};
