module.exports = {
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current',
            },
          },
        ],
        'module:./example/node_modules/metro-react-native-babel-preset',
      ],
    },
  },
};
