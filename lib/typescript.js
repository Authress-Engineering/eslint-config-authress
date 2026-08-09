/**
 * TypeScript-specific ESLint config from @authress/eslint-config.
 *
 * Usage in consumer's eslint.config.js:
 *
 *   import baseConfig from "@authress/eslint-config";
 *   import { typescriptConfig } from "@authress/eslint-config/typescript";
 *
 *   export default [
 *     ...baseConfig,
 *     ...typescriptConfig,
 *     {
 *       files: ["src/**\/*.ts"],
 *       languageOptions: {
 *         parserOptions: {
 *           project: "./tsconfig.json",
 *           tsconfigRootDir: import.meta.dirname,
 *         },
 *       },
 *     },
 *   ];
 */

import { authressPlugin } from "./index.js";

let tseslint;
try {
  tseslint = (await import("typescript-eslint")).default;
} catch {
  // typescript-eslint not installed — export empty config
}

export const typescriptConfig = tseslint ? [
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      authress: authressPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      // Catch un-awaited promises (including ResultAsync)
      "@typescript-eslint/no-floating-promises": "error",

      // Catch discarded Result values (requires type info — already in base config but re-stated for clarity)
      "authress/must-use-result": "error",

      // Disable base rules that conflict with TS equivalents
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { vars: "all", args: "after-used", ignoreRestSiblings: true }],
      "no-undef": "off",
      "consistent-return": "off",
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": ["error", "nofunc"],
      "require-await": "off",
      "@typescript-eslint/require-await": "error",
      "no-return-await": "off",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
    },
  },
] : [];
