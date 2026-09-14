import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // Type-only imports must say so: Node's type stripping removes `import type` but would try to
      // resolve a value import of a type at runtime.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // Production builds stay console-clean; contractWarn() uses console.warn in dev only.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["scripts/**/*.{ts,mjs}"],
    rules: { "no-console": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the Zod schemas by `pnpm contract:export`.
    "docs/contract/**",
  ]),
]);

export default eslintConfig;
