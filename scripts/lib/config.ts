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

    const allFiles = [
        ...new Bun.Glob("*").scanSync(
            resolve(thisWorkSpace, "dist", "assets"),
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
    electrobunConfig.build.copy[`bin/`] = `bin/`;

    if (!isDev) {
        electrobunConfig.build.copy[`data/tempsystem.json`] = `data/system.json`;
    }
    else {
        electrobunConfig.build.copy[`data/system.json`] = `data/system.json`;
    }

    const tempConfig = `import type { ElectrobunConfig } from "electrobun";\n\nexport default ${JSON.stringify(electrobunConfig, null, 2)} satisfies ElectrobunConfig`

    console.info("\nRewriting Electrobun config...");
    await Bun.write(resolve(thisWorkSpace, "electrobun.config.ts"), tempConfig);
    console.info("Done.");
    return electrobunConfigText
}