import base from "@vbph/config/eslint-base";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  ...base,
  {
    ignores: ["src-tauri/target/**", "src-tauri/gen/**", "dist/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
