import { resolve } from "node:path";
import { config } from "dotenv";
import chose from "./lib/chose";
config();

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

console.log("Use ↑/↓ to select, Enter to confirm:\n");
const isLocal = await chose("Is Local:", ["yes", "no"]);
const isDiscord = await chose("Is Discord:", ["yes", "no"]);

const thisWorkSpace = import.meta.url.split("file:///")[1];
const systemFile = Bun.file(
    resolve(thisWorkSpace, "..", "..", "data", "system.json"),
);
const system = await systemFile.json();
system.isLocal = isLocal;
system.isDiscord = isDiscord;

console.info(
    `This development turn will be started with settings:\n${isDiscord ? "Using" : "Not using"} discord RPC\n${isLocal ? "Using" : "Not using"} local file and download music`,
);

await Bun.write(
    resolve(thisWorkSpace, "..", "..", "data", "system.json"),
    JSON.stringify(system),
);

const electrobunConfigText = await Bun.file(
    resolve(thisWorkSpace, "..", "..", "electrobun.config.ts"),
).text();

const objectString = electrobunConfigText
    .split("export default ")[1]
    .split(" satisfies ElectrobunConfig")[0]
    .trim();

const electrobunConfig = new Function(`return ${objectString}`)();

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

electrobunConfig.build.copy[`data/system.json`] = `data/system.json`;
electrobunConfig.build.copy[`.env`] = `/.env`;
electrobunConfig.build.copy[`bin/`] = `bin/`;

const tempConfig = `import type { ElectrobunConfig } from "electrobun";\n\nexport default ${JSON.stringify(electrobunConfig, null, 2)} satisfies ElectrobunConfig`;

console.info("\nRewriting Electrobun config...");
await Bun.write(
    resolve(thisWorkSpace, "..", "..", "electrobun.config.ts"),
    tempConfig,
);

console.info("Done.");
console.info("\n\n");
console.info("Starting...");

const a = Bun.spawn(["bunx", "electrobun", "dev"], {
    stdout: "inherit",
});

setTimeout(async () => {
    console.info("Restoring Electrobun config...");
    await Bun.write(
        resolve(thisWorkSpace, "..", "..", "electrobun.config.ts"),
        electrobunConfigText,
    );
    console.info("Done.");
}, 2000);

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
