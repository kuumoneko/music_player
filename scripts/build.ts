import { resolve } from "node:path";
import { config } from "dotenv";
// config
import ElectroBunConfig from "./config/config";
import system from "./config/system";
// build
import Build_Front_End from "./build/client";
import Build_Electrobun from "./build/electrobun";
import Build_main_process from "./build/main";
config();

let isBuildElectrobun: boolean = process.argv.includes("-be") || process.argv.includes("--build-electrobun");

if (isBuildElectrobun) {
    await Build_Electrobun();
}

try {
    await Build_Front_End()
} catch (error) {
    console.error(error);
    process.exit(0);
}


const thisWorkSpace = resolve(import.meta.path.split(import.meta.file)[0], "..");
await system(thisWorkSpace, true, true, "tempsystem")
await ElectroBunConfig(thisWorkSpace, false)

await Build_main_process();

console.info("Deleting temporary files...")
await Bun.file(resolve(thisWorkSpace, "temp_electrobun.config.ts")).delete()
await Bun.file(resolve(thisWorkSpace, "data", "tempsystem.json")).delete()
console.info("Done.")

process.exit(0)