import { resolve } from "node:path";

export default async function config(thisWorkSpace: string, isDev: boolean) {
    const electrobunConfigText = await Bun.file(
        resolve(thisWorkSpace, "electrobun.config.ts"),
    ).text();

    const objectString = electrobunConfigText
        .split("export default ")[1]
        .split(" satisfies ElectrobunConfig")[0]
        .trim();

    const electrobunConfig = new Function(`return ${objectString}`)();

    electrobunConfig.build.copy[`dist/`] = `views/src`;
    electrobunConfig.build.copy[`bin/`] = `bin/`;
    electrobunConfig.build.copy[`data/${!isDev ? "temp" : ""}system.json`] = `data/system.json`;

    const tempConfig = `import type { ElectrobunConfig } from "electrobun";\n\nexport default ${JSON.stringify(electrobunConfig, null, 2)} satisfies ElectrobunConfig`

    console.info("\nRewriting Electrobun config...");
    await Bun.write(resolve(thisWorkSpace, "electrobun.config.ts"), tempConfig);
    console.info("Done.");
    return electrobunConfigText
}