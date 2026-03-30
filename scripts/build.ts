import { resolve } from "node:path";
import { config } from "dotenv";
config()

console.info("Building vite...");
try {
    Bun.spawnSync({
        cmd: ["vite", "build"],
    });
} catch (error) {
    console.error(error);
    process.exit(0);
}
console.info("Done.");


const thisWorkSpace = import.meta.url.split("file:///")[1];
const systemFile = Bun.file(
    resolve(thisWorkSpace, "..", "..", "data", "system.json"),
);
const system = await systemFile.json();
system.isLocal = true;
system.isDiscord = true;

await Bun.write(
    resolve(thisWorkSpace, "..", "..", "data", "tempsystem.json"),
    JSON.stringify(system)
);

let DiscordClientId = process.env["CLIENT_ID"];

const electrobunConfigText = await Bun.file(resolve(thisWorkSpace, "..", "..", "electrobun.config.ts")).text();

const objectString = electrobunConfigText
    .split("export default ")[1].split(" satisfies ElectrobunConfig")[0]
    .trim();

const electrobunConfig = (new Function(`return ${objectString}`))();
electrobunConfig.build.copy["temp.env"] = ".env";

const allFiles = [
    ...new Bun.Glob("*").scanSync(
        resolve(thisWorkSpace, "..", "..", "dist", "assets"),
    ),
];

const player = allFiles.filter(
    (item) => item.includes("player") || item.includes("type"),
);
const mainUI = allFiles.filter(
    (item) => !player.includes(item) || item.includes("type"),
);

player.forEach((item) => {
    electrobunConfig.build.copy[`dist/assets/${item}`] = `views/assets/${item}`;
});

mainUI.forEach((item) => {
    electrobunConfig.build.copy[`./dist/assets/${item}`] =
        `views/src/assets/${item}`;
});

await Bun.write(
    resolve(thisWorkSpace, "..", "..", "temp.env"),
    `CLIENT_ID=${DiscordClientId}`
)

electrobunConfig.build.copy["data/tempsystem.json"] = "data/system.json";
const tempConfig = `import type { ElectrobunConfig } from "electrobun";\n\nexport default ${JSON.stringify(electrobunConfig, null, 2)} satisfies ElectrobunConfig`

console.info("\nRewriting Electrobun config...");
await Bun.write(resolve(thisWorkSpace, "..", "..", "electrobun.config.ts"), tempConfig);
console.info("Done.");

console.info("\nBuilding...")
Bun.spawnSync(["bunx", "electrobun", "build", "--env=stable"], { stdout: "inherit" })
console.info("Done.")

console.info("Deleting temporary files...")
await Bun.write(resolve(thisWorkSpace, "..", "..", "electrobun.config.ts"), electrobunConfigText)
await Bun.file(resolve(thisWorkSpace, "..", "..", "temp.env")).unlink()
await Bun.file(resolve(thisWorkSpace, "..", "..", "data", "tempsystem.json")).unlink()
console.info("Done.")


process.exit(0)