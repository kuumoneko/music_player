import { resolve } from "node:path";
import { config as envConfig } from "dotenv";
import { ElectrobunConfig } from "electrobun";

envConfig();

export default async function config(thisWorkSpace: string, isDev: boolean) {
    const packageJson = await Bun.file(
        resolve(thisWorkSpace, "package.json")
    ).json();

    const electrobunConfig: ElectrobunConfig = {
        release: {
            baseUrl: `https://github.com/${process.env["GHUSERNAME"]}/${process.env["REPO"]}/releases/download`,
        },
        build: {
            bunVersion: packageJson.dependencies.bun.split("^")[1],
            win: {
                bundleCEF: false,
                icon: "assets/favicon.ico"
            },
            copy: {}
        },
        app: {
            name: packageJson.name,
            identifier: process.env["IDENTIFIER"] ?? "local.build.dev",
            version: packageJson.version
        }
    } satisfies ElectrobunConfig;

    // default config
    electrobunConfig.build.copy[`dist/`] = `views/src`;
    electrobunConfig.build.copy[`bin/`] = `../../`;
    electrobunConfig.build.copy[`assets/`] = `assets/`;
    electrobunConfig.build.copy[`data/${!isDev ? "temp" : ""}system.json`] = `data/system.json`;

    const tempConfig = `import type { ElectrobunConfig } from "electrobun";\n\nexport default ${JSON.stringify(electrobunConfig, null, 2)} satisfies ElectrobunConfig`

    console.info("\nRewriting Electrobun config...");
    await Bun.write(resolve(thisWorkSpace, "temp_electrobun.config.ts"), tempConfig);
    console.info("Done.");
}