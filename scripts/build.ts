import { resolve } from "node:path";
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";

const root = resolve(import.meta.dir, "..");
const dev = process.argv.includes("--dev");

const result = await Bun.build({
    entrypoints: [resolve(root, "src", "bun", "index.ts")],
    target: "bun",
    outdir: resolve(root, "build"),
    naming: "backend.js",
    minify: !dev,
    sourcemap: dev ? "none" : "linked",
});

for (const log of result.logs) console.error(log);
if (!result.success) process.exit(1);

const binDir = resolve(root, "build", "bin");
rmSync(binDir, { recursive: true, force: true });
mkdirSync(binDir, { recursive: true });
for (const file of readdirSync(resolve(root, "bin")).filter(f => f !== ".git")) {
    copyFileSync(resolve(root, "bin", file), resolve(binDir, file));
    copyFileSync(resolve(root, "bin", file), resolve(root, "build", file));
}

console.info("Backend bundle written to build/backend.js (native DLLs copied next to it and to build/bin/).");
process.exit(0);
