const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const jest = require("eslint-plugin-jest");
const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2018,
        sourceType: "module",
        parserOptions: {},

        globals: {
            ...jest.environments.globals.globals,
            ...globals.node,
            __DEV__: true,
            console: true,
            should: true,
            Utils: true,
            window: true,
        },
    },

    extends: compat.extends(
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
        "plugin:prettier/recommended",
    ),

    plugins: {
        jest,
    },

    settings: {
        react: {
            version: "16.1.0",
        },
    },

    rules: {
        "jest/no-identical-title": 0,
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/prefer-to-have-length": "warn",
        "jest/valid-expect": "error",
        "eslint-comments/no-unlimited-disable": 0,
        "no-new": 0,
        "no-continue": 0,
        "no-extend-native": 0,
        "import/no-dynamic-require": 0,
        "global-require": "off",
        "class-methods-use-this": 0,
        "no-console": 1,
        "no-plusplus": 0,
        "no-undef": "error",
        "no-shadow": 0,
        "no-catch-shadow": 0,
        "no-underscore-dangle": "off",
        "no-use-before-define": 0,
        "import/no-unresolved": 0,
        "no-empty-description": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/camelcase": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/ban-ts-ignore": "off",
        "mocha/no-skipped-tests": "off",
        "mocha/no-top-level-hooks": "off",
        "mocha/no-hooks-for-single-case": "off",
        "mocha/no-setup-in-describe": "off",
        "mocha/no-mocha-arrows": "off",
    },
}, globalIgnores([
    "lib/version.js",
    "**/node_modules/**/*",
    "**/node_modules",
    "**/scripts/",
    "**/coverage",
    "**/docs",
    "**/dist/",
])]);
