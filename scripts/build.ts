import { resolve } from "node:path";
import { config } from "dotenv";
// config
import chose from "./config/chose";
import ElectroBunConfig from "./config/config";
import system from "./config/system";
// build
import Build_Front_End from "./build/client";
import Build_Electrobun from "./build/electrobun";
import Build_main_process from "./build/main";
config();

console.log("\nUse ↑/↓ to select, Enter to confirm:\n");
const isBuildElectrobun = await chose("Do you want to build Local Electrobun first?", true);

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
const electrobunConfigText = await ElectroBunConfig(thisWorkSpace, false)

await Build_main_process();

console.info("Deleting temporary files...")
await Bun.write(resolve(thisWorkSpace, "electrobun.config.ts"), electrobunConfigText)
await Bun.file(resolve(thisWorkSpace, "data", "tempsystem.json")).unlink()
console.info("Done.")


process.exit(0)