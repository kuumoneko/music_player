import { resolve } from "node:path";
import { config } from "dotenv";
// config
import ElectroBunConfig from "./config/config";
import system from "./config/system";
// build
import Build_Front_End from "./build/client";
import Build_Electrobun from "./build/electrobun";

config();

let isBuildElectrobun: boolean = process.argv.includes("-be") || process.argv.includes("--build-electrobun");
let isBuildClient: boolean = process.argv.includes("-bc") || process.argv.includes("--build-client");
let isLocal: boolean = process.argv.includes("-ul") || process.argv.includes("--use-local");
let isDiscord: boolean = process.argv.includes("-ud") || process.argv.includes("--use-discord");

if (isBuildElectrobun) {
    await Build_Electrobun();
}

if (isBuildClient) {
    try {
        await Build_Front_End()
    } catch (error) {
        console.error(error);
        process.exit(0);
    }
}

const thisWorkSpace = resolve(import.meta.path.split(import.meta.file)[0], "..");
await system(thisWorkSpace, isLocal, isDiscord, "system")

console.info(
    `This development turn will be started with settings:\n${isDiscord ? "Using" : "Not using"} discord RPC\n${isLocal ? "Using" : "Not using"} local file and download music`,
);
await ElectroBunConfig(thisWorkSpace, true)

console.info("\n\n");
console.info("Starting...");

const a = Bun.spawn(["bunx", "electrobun", "dev", "--config=temp_electrobun.config.ts"], { stdout: "inherit", stderr: "inherit" })

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", async (key) => {
    // Check for 'q' or Ctrl+C (\u0003)
    if (key === "q" || key === "\u0003") {
        console.warn("\nExitting development turn.");

        console.log("\nDeleting temporary config...");
        await Bun.file(resolve(thisWorkSpace, "temp_electrobun.config.ts")).delete();
        console.log("Done.")

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