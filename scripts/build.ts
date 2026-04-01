import { resolve } from "node:path";
import { config } from "dotenv";
import chose from "./lib/chose";
import Build_Electrobun from "./lib/electrobun";
import system from "./lib/system";
import ElectroBunConfig from "./lib/config"
config()

console.info("Building vite...");
try {
    Bun.spawnSync({ cmd: ["vite", "build"], stdout: "inherit" });
} catch (error) {
    console.error(error);
    process.exit(0);
}
console.info("Done.");

console.log("\nUse ↑/↓ to select, Enter to confirm:\n");
const isBuildElectrobun = await chose("Do you want to build Local Electrobun first?", false);

if (isBuildElectrobun) {
    await Build_Electrobun()
}

const thisWorkSpace = resolve(import.meta.url.split("file:///")[1], "..", "..");
await system(thisWorkSpace, true, true, "tempsystem")
const electrobunConfigText = await ElectroBunConfig(thisWorkSpace, false)


console.info("\nBuilding...")
Bun.spawnSync(["bunx", "electrobun", "build", "--env=stable"], { stdout: "inherit" })
console.info("Done.")

console.info("Deleting temporary files...")
await Bun.write(resolve(thisWorkSpace, "electrobun.config.ts"), electrobunConfigText)
await Bun.file(resolve(thisWorkSpace, "temp.env")).unlink()
await Bun.file(resolve(thisWorkSpace, "data", "tempsystem.json")).unlink()
console.info("Done.")


process.exit(0)