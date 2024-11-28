module.exports = {
  env: {
    test: {
      presets: ['module:@react-native/babel-preset'],
    },
  },
  plugins: [['@babel/plugin-proposal-private-property-in-object', { loose: true }]],
};
