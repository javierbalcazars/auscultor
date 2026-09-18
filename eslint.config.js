export default [
  {
    ignores: ["node_modules/**", "Vault/**", "auth_session/**", "data/**", "coverage/**"],
  },
  {
    files: ["src/**/*.js", "scripts/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        AbortController: "readonly",
        Buffer: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        DOMException: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-constant-condition": "error",
      "no-debugger": "error",
      "no-dupe-keys": "error",
      "no-fallthrough": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
