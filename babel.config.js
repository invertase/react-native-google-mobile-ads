module.exports = {
  env: {
    test: {
      presets: ['module:metro-react-native-babel-preset'],
    },
  },
  plugins: [['@babel/plugin-proposal-private-property-in-object', { loose: true }]],
};
