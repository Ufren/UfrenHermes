import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: ["**/dist/**", "**/dist-types/**", "release/**", "release-*/**", "~/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.eslint.json"
        }
      }
    },
    rules: {
      ...tsPlugin.configs["recommended-type-checked"].rules,
      ...tsPlugin.configs["stylistic-type-checked"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "error",
      "import/no-default-export": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { "prefer": "type-imports", "fixStyle": "separate-type-imports" }
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error"
    }
  },
  {
    files: ["**/vite.config.ts"],
    rules: {
      "import/no-default-export": "off"
    }
  },
  eslintConfigPrettier
];
