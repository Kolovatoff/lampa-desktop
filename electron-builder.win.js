const pkg = require('./package.json');

module.exports = {
  ...pkg.build, 
  ...(pkg.files ? { files: pkg.files } : {}),
  
  artifactName: 'lampa-${version}-${arch}-setup.${ext}',

  win: {
    ...pkg.build.win,
    icon: 'build/icons/win/icon.ico',
    verifyUpdateCodeSignature: true,
    target: [
      { target: 'nsis', arch: ['x64', 'arm64'] }
    ]
  },

  nsis: {
    oneClick: false,
    perMachine: true,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: false,
    installerIcon: 'build/icons/win/icon.ico',
    uninstallerIcon: 'build/icons/win/icon.ico',
    license: 'LICENSE',
    artifactName: 'lampa-${version}-${arch}-setup.${ext}'
  },

  // Портативная версия
  //   portable: {
  //     artifactName: 'lampa-${version}-${arch}-portable.${ext}'
  //   }
};