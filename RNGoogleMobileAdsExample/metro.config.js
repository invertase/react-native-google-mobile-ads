const { makeMetroConfig } = require('@rnx-kit/metro-config');
const path = require('path');
module.exports = makeMetroConfig({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  watchFolders: [path.join(__dirname, '..')],
});
