import { resolve } from "node:path";
import { config } from "dotenv";
// config
import chose from "./config/chose";
import ElectroBunConfig from "./config/config";
import system from "./config/system";
// build
import Build_Front_End from "./build/client";
import Build_Electrobun from "./build/electrobun";

config();

try {
    await Build_Front_End()
} catch (error) {
    console.error(error);
    process.exit(0);
}

console.log("\nUse ↑/↓ to select, Enter to confirm:\n");
const isLocal: boolean = await chose("Is Local?", true);
const isDiscord: boolean = await chose("Is Discord?", true);
const isBuildElectrobun = await chose("Do you want to build Local Electrobun first?", false);

if (isBuildElectrobun) {
    await Build_Electrobun()
}

const thisWorkSpace = resolve(import.meta.path.split(import.meta.file)[0], "..");
await system(thisWorkSpace, isLocal, isDiscord, "system")

console.info(
    `This development turn will be started with settings:\n${isDiscord ? "Using" : "Not using"} discord RPC\n${isLocal ? "Using" : "Not using"} local file and download music`,
);
const electrobunConfigText = await ElectroBunConfig(thisWorkSpace, true)

console.info("\n\n");
console.info("Starting...");

const a = Bun.spawn(["bunx", "electrobun", "dev"], { stdout: "inherit", stderr: "inherit" })
setTimeout(async () => {
    console.info("Restoring Electrobun config...");
    await Bun.write(
        resolve(thisWorkSpace, "electrobun.config.ts"),
        electrobunConfigText,
    );
    console.info("Done.");
}, 500);

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", async (key) => {
    // Check for 'q' or Ctrl+C (\u0003)
    if (key === "q" || key === "\u0003") {
        console.warn("\nExitting development turn.");

        console.info("\nKilling electrobun dev...");
        Bun.spawnSync(["taskkill", "/F", "/T", "/PID", a.pid.toString()]);
        console.info("Done.");
        process.exit(0);
    }
});

a.exited.then((code: number) => {
    console.error(code)
    console.warn("\nExitting development turn.");
    process.exit(0);
})