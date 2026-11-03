import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/engine/**/*.ts"],
    ignores: ["src/engine/**/*.test.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "The engine takes time as input; it never reads a clock." },
      ],
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-dom", "next", "next/*"] },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", ".agents/**", ".claude/**", ".codex/**", ".impeccable/**"]),
]);
