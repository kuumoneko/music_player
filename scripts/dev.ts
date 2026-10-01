import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// `bun run dev` = the WinUI host dev loop; pass `--avalonia` for the Avalonia one.
// (The two cannot run side by side: both write the shared %APPDATA%\KuumoApp sqlite,
// and winui-dev/avalonia-dev refuse to start while the other frontend is running.)
const root = resolve(import.meta.dir, "..");
const argv = process.argv.slice(2);
const avalonia = argv.includes("--avalonia");
const script = avalonia ? "avalonia-dev.ts" : "winui-dev.ts";
const passthrough = argv.filter((a) => a !== "--avalonia");

const result = spawnSync("bun", ["run", "--silent", `./scripts/${script}`, ...passthrough], {
    cwd: root,
    stdio: "inherit",
});
process.exit(result.status ?? 0);
