import js from "@eslint/js";
import { defineConfig } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 11,
      sourceType: "script",
      parserOptions: {
        ecmaFeatures: {
          globalReturn: true
        }
      },
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
        fetch: "readonly",
        requestAnimationFrame: "readonly",
        Node: "readonly",
        URL: "readonly",
        AbortController: "readonly",
        WebSocket: "readonly",
        // LuCI globals
        L: "readonly",
        $$: "readonly",
        _: "readonly",
        E: "readonly",
        // legacy required modules & aliases
        baseclass: "readonly",
        ui: "readonly",
        uci: "readonly",
        rpc: "readonly",
        fs: "readonly",
        poll: "readonly",
        network: "readonly",
        validation: "readonly",
        dom: "readonly",
        widgets: "readonly",
        request: "readonly",
        view: "readonly",
        common: "readonly",
        mihomoApi: "readonly",
        ubusApi: "readonly",
        fsApi: "readonly",
        clipboard: "readonly",
        form: "readonly",
        luciSession: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-empty": "warn",
      "no-constant-condition": "warn",
      "no-control-regex": "off",
      "quotes": ["error", "double", { "avoidEscape": true }],
      "eqeqeq": ["error", "always"],
      "no-useless-escape": "error"
    }
  }
]);
