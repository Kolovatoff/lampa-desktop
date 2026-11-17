const pkg = require("./package.json");

module.exports = {
  ...pkg.build,
  ...(pkg.files ? { files: pkg.files } : {}),

  artifactName: "lampa-${version}-${arch}.${ext}",

  mac: {
    ...pkg.build.mac,
    category: "public.app-category.video",
    icon: "build/icons/mac/icon.icns",
    target: [
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] }, // zip нужен для авто-обновлений
    ],
  },

  dmg: {
    artifactName: "lampa-${version}-${arch}.dmg",
  },
};
