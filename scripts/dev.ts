import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// `bun run dev` = the WinUI host dev loop (thin dispatcher so extra flags pass through).
const root = resolve(import.meta.dir, "..");
const passthrough = process.argv.slice(2);

const result = spawnSync("bun", ["run", "--silent", "./scripts/winui-dev.ts", ...passthrough], {
    cwd: root,
    stdio: "inherit",
});
process.exit(result.status ?? 0);
