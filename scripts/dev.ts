import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const PROFILE = "myown";
const devDataDir = resolve(root, "data", "dev");

const profileFile = resolve(root, "apikeys", `${PROFILE}.json`);
if (!existsSync(profileFile)) {
    console.error(`Missing profile file: ${profileFile}`);
    process.exit(1);
}

// Bake the profile's credentials (encrypted keys + googleClientId) into data/system.json.
const encrypt = spawnSync("bun", ["./scripts/encrypt-credentials.ts", "--profile", PROFILE], {
    cwd: root,
    stdio: "inherit",
});
if (encrypt.status !== 0) process.exit(encrypt.status ?? 1);

const defaults = [
    "--data-dir",
    devDataDir,
    "--assets",
    root,
];

const child = Bun.spawn(["bun", "--watch", "src/bun/index.ts", ...defaults, ...process.argv.slice(2)], {
    cwd: root,
    stdio: ["inherit", "inherit", "inherit"],
});

const exitCode = await child.exited;
process.exit(exitCode ?? 0);
