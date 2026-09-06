// Builds a self-extracting installer using NanaZip/7-Zip SFX.
// Replaces the Inno Setup step in the packaging pipeline.
//
// Pipeline:
//   1. Find NanaZip/7z CLI and SFX module
//   2. Compress build/package/ → build/payload.7z (LZMA2)
//   3. Generate SFX config.txt
//   4. Concatenate: SFX module + config.txt + payload.7z → artifacts/<name>-setup.exe
//
// Usage:
//   bun run scripts/build-setup.ts --version 7.0.0 --profile myown
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, statSync, mkdirSync, unlinkSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dir, "..");

// --- Version from package.json ---
const pkgJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version: string = pkgJson.version ?? "0.0.0";

// --- Args ---
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : undefined;
}
const profile = getArg("--profile") ?? "release";

// --- Paths ---
const buildDir = resolve(root, "build");
const packageDir = resolve(buildDir, "package");
const payload7z = resolve(buildDir, "payload.7z");
const configFile = resolve(buildDir, "sfx-config.txt");
const artifactsDir = resolve(root, "artifacts");

function baseName(): string {
    return profile === "release"
        ? `kuumoapp_${version}-setup`
        : `kuumoapp_${profile}_${version}-setup`;
}

// --- Find NanaZip/7z ---
function find7z(): string {
    // Check PATH
    const where = spawnSync("where", ["7z"], { encoding: "utf8", shell: true });
    if (where.status === 0 && where.stdout?.trim()) {
        return where.stdout.trim().split(/\r?\n/)[0].trim();
    }
    // Check NanaZip WindowsApps alias
    const alias = resolve(process.env["LOCALAPPDATA"] ?? "", "Microsoft", "WindowsApps", "7z.exe");
    if (existsSync(alias)) return alias;
    // Check standard 7-Zip install
    const programFiles = [
        process.env["ProgramFiles"],
        process.env["ProgramFiles(x86)"],
    ].filter(Boolean);
    for (const pf of programFiles) {
        const candidate = resolve(pf!, "7-Zip", "7z.exe");
        if (existsSync(candidate)) return candidate;
    }
    return "";
}

function findSfxModule(): string {
    // Check NanaZip install
    const nanazip = spawnSync("powershell.exe", [
        "-NoProfile", "-Command",
        "(Get-AppxPackage -Name '*NanaZip*').InstallLocation",
    ], { encoding: "utf8" });
    if (nanazip.status === 0 && nanazip.stdout?.trim()) {
        const installDir = nanazip.stdout.trim();
        const sfx = resolve(installDir, "NanaZip.Core.Windows.sfx");
        if (existsSync(sfx)) return sfx;
        const sfxConsole = resolve(installDir, "NanaZip.Core.Console.sfx");
        if (existsSync(sfxConsole)) return sfxConsole;
    }
    // Check standard 7-Zip extra SFX modules
    const programFiles = [
        process.env["ProgramFiles"],
        process.env["ProgramFiles(x86)"],
    ].filter(Boolean);
    for (const pf of programFiles) {
        for (const name of ["7zSD.sfx", "7zS.sfx"]) {
            const candidate = resolve(pf!, "7-Zip", name);
            if (existsSync(candidate)) return candidate;
        }
    }
    return "";
}

// --- Main ---
function main() {
    console.log(`\nBuilding SFX installer: ${baseName()}.exe\n`);

    // Validate payload exists
    if (!existsSync(packageDir)) {
        console.error(`Payload directory not found: ${packageDir}`);
        console.error("Run 'bun run build:prod' and assemble the payload first.");
        process.exit(1);
    }

    // Find tools
    const sevenZip = find7z();
    if (!sevenZip) {
        console.error("7z.exe / NanaZip not found. Install NanaZip or 7-Zip and retry.");
        process.exit(1);
    }
    console.log(`7z: ${sevenZip}`);

    const sfxModule = findSfxModule();
    if (!sfxModule) {
        console.error("SFX module not found (NanaZip.Core.Windows.sfx or 7zSD.sfx).");
        process.exit(1);
    }
    console.log(`SFX: ${sfxModule}`);

    // 1) Compress payload
    console.log("\nCompressing payload...");
    if (existsSync(payload7z)) {
        unlinkSync(payload7z);
    }
    const compress = spawnSync(sevenZip, [
        "a", "-t7z", "-m0=lzma2", "-mx=9", "-mmt=4",
        payload7z,
        join(packageDir, "*"),
    ], { encoding: "utf8", cwd: buildDir, stdio: "inherit" });
    if (compress.status !== 0) {
        console.error("7z compression failed.");
        process.exit(compress.status ?? 1);
    }
    const archiveSize = statSync(payload7z).size;
    console.log(`Archive: ${(archiveSize / 1024 / 1024).toFixed(1)} MB`);

    // 2) Generate SFX config
    console.log("\nGenerating SFX config...");
    const config = [
        ";!@Install@!UTF-8!",
        `Title="KuumoApp ${version} Setup"`,
        `InstallPath="%LOCALAPPDATA%\\\\KuumoApp"`,
        `RunProgram="app\\\\backend\\\\bun.exe app\\\\setup.js --install-dir %%T --seed --version ${version}"`,
        ";!@InstallEnd@!",
    ].join("\n");
    writeFileSync(configFile, config, "utf8");

    // 3) Concatenate SFX + config + archive
    console.log("Assembling setup.exe...");
    mkdirSync(artifactsDir, { recursive: true });
    const outputExe = resolve(artifactsDir, `${baseName()}.exe`);

    // Use copy /b on Windows
    const copyCmd = `copy /b "${sfxModule}" + "${configFile}" + "${payload7z}" "${outputExe}"`;
    const copy = spawnSync("cmd", ["/c", copyCmd], { encoding: "utf8", shell: true });
    if (copy.status !== 0 || !existsSync(outputExe)) {
        console.error("Failed to concatenate SFX files.");
        console.error(copy.stderr ?? copy.stdout ?? "");
        process.exit(1);
    }

    const finalSize = statSync(outputExe).size;
    console.log(`\nDone: ${outputExe}`);
    console.log(`Size: ${(finalSize / 1024 / 1024).toFixed(1)} MB`);
}

main();
