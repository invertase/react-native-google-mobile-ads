const { makeMetroConfig } = require('@rnx-kit/metro-config');
const { FileStore } = require('metro-cache');
const path = require('path');

const cacheRoot = process.env.RNGMA_METRO_CACHE_ROOT;

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
  ...(cacheRoot
    ? {
        cacheStores: [
          new FileStore({
            root: path.join(cacheRoot, 'metro-transform-cache'),
          }),
        ],
      }
    : {}),
});
