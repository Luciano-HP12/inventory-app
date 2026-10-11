import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["*.{js,mjs,cjs}", "**/*.config.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["apps/{api,worker}/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["apps/{web,admin}/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
