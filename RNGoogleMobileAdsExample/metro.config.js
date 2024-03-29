/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const path = require('path');
const fs = require('fs');
const appendExclusions = require('metro-config/src/defaults/exclusionList');

// Escape function taken from the MDN documentation: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
function escapeRegExp(string) {
  return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// NOTE: The Metro bundler does not support symlinks (see https://github.com/facebook/metro/issues/1), which NPM uses for local packages.
//       To work around this, we supplement the logic to follow symbolic links.

// Create a mapping of package ids to linked directories.
function processModuleSymLinks() {
  const nodeModulesPath = path.resolve(__dirname, 'node_modules');
  let moduleMappings = {};
  let moduleExclusions = [];

  function findPackageDirs(directory) {
    fs.readdirSync(directory).forEach(item => {
      const itemPath = path.resolve(directory, item);
      const itemStat = fs.lstatSync(itemPath);
      if (itemStat.isSymbolicLink()) {
        let linkPath = fs.readlinkSync(itemPath);
        // Sym links are relative in Unix, absolute in Windows.
        if (!path.isAbsolute(linkPath)) {
          linkPath = path.resolve(directory, linkPath);
        }
        const linkStat = fs.statSync(linkPath);
        if (linkStat.isDirectory()) {
          const packagePath = path.resolve(linkPath, 'package.json');
          if (fs.existsSync(packagePath)) {
            const packageId = path.relative(nodeModulesPath, itemPath);
            moduleMappings[packageId] = linkPath;

            const packageInfoData = fs.readFileSync(packagePath);
            const packageInfo = JSON.parse(packageInfoData);

            // Search for any dev dependencies of the package. They should be excluded from metro so the packages don't get
            // imported twice in the bundle.
            for (let devDependency in packageInfo.devDependencies) {
              moduleExclusions.push(
                new RegExp(
                  escapeRegExp(
                    path.join(linkPath, 'node_modules', devDependency),
                  ) + '/.*',
                ),
              );
            }
          }
        }
      } else if (itemStat.isDirectory()) {
        findPackageDirs(itemPath);
      }
    });
  }

  findPackageDirs(nodeModulesPath);

  return [moduleMappings, moduleExclusions];
}

const [moduleMappings, moduleExclusions] = processModuleSymLinks();
console.log('Mapping the following sym linked packages:');
console.log(moduleMappings);

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },

  resolver: {
    // Register an "extra modules proxy" for resolving modules outside of the normal resolution logic.
    extraNodeModules: new Proxy(
      // Provide the set of known local package mappings.
      moduleMappings,
      {
        // Provide a mapper function, which uses the above mappings for associated package ids,
        // otherwise fall back to the standard behavior and just look in the node_modules directory.
        get: (target, name) =>
          name in target
            ? target[name]
            : path.join(__dirname, `node_modules/${name}`),
      },
    ),
    blacklistRE: appendExclusions(moduleExclusions),
  },

  projectRoot: path.resolve(__dirname),

  // Also additionally watch all the mapped local directories for changes to support live updates.
  watchFolders: Object.values(moduleMappings),
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);