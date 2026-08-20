// Shared ESLint flat config for plain TypeScript packages (non-Next.js).
// apps/web uses eslint-config-next directly instead of this.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  }
);
