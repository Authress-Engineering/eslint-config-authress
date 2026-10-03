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

      // All diagnostic output must go through a structured logger carrying a code and
      // full context. A bare console.* bypasses redaction, payload limits, and log
      // routing — the only sanctioned sinks (the logger implementation itself, and
      // deliberate best-effort fallbacks) carry an inline eslint-disable with a reason.
      "no-console": "error",

      // The `void` operator detaches a promise. In a Lambda backend that promise is
      // orphaned when the container freezes after the response and resumes into a
      // severed-socket error on thaw. Warn here (shared, used by non-Lambda projects
      // too); Lambda backends escalate this to `error` in their own config.
      "no-restricted-syntax": ["warn",
        { selector: "UnaryExpression[operator='void']", message: "Avoid the `void` operator on a promise: it detaches work that may be orphaned (in a Lambda backend, the frozen container never finishes it). Await the promise instead." },
      ],

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
