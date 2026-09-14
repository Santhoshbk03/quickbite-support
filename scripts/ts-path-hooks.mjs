/**
 * Minimal module-resolution hooks so `node` can run the TypeScript in src/ directly, using Node's
 * built-in type stripping. Zero dependencies on purpose: the contract tooling should not need a
 * bundler or a test runner to be useful.
 *
 * Handles the two things Node does not do by itself:
 * - the `@/*` path alias from tsconfig.json
 * - extensionless relative imports (`./schemas` -> `./schemas.ts`)
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(projectRoot, "src");
const SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function firstExistingFile(basePath) {
  for (const suffix of SUFFIXES) {
    const candidate = basePath + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let basePath = null;

  if (specifier.startsWith("@/")) {
    basePath = path.join(srcRoot, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    basePath = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (basePath) {
    const resolved = firstExistingFile(basePath);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  return nextResolve(specifier, context);
}
