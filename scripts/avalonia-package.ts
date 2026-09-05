// Builds the Avalonia + Bun payload, assembles a setup.exe with Inno Setup.
//
// Pipeline (per profile):
//   encrypt-credentials --profile X -> data/system.json with profile X's keys
//   bun run build:prod              -> build/backend.js + build/bin/*.dll
//   dotnet publish                  -> Avalonia publish output (framework-dependent .NET)
//   assemble                        -> build/avalonia-package/ (flat layout)
//   ISCC.exe setup-avalonia.iss     -> artifacts/kuumoapp-avalonia[_<profile>]_{version}-setup.exe
//
// Unlike the WinUI build, there is NO launcher exe and NO Windows App SDK
// dependency — the Avalonia exe IS the main entry point, kept flat at the
// package root. Runtime prerequisite (.NET Desktop Runtime) is installed by
// setup-avalonia.iss at install time via scripts/install-prereqs-avalonia.ps1.
//
// Usage:
//   bun run avalonia:package                     -> builds ALL profiles (myown first, release last)
//   bun run avalonia:package --profile myown     -> builds only that profile
//   bun run avalonia:package --cached            -> skips profile-independent builds if outputs exist
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const useCache = process.argv.includes("--cached");

function run(cmd: string, args: string[], cwd: string = root) {
    console.log(`\n> ${cmd} ${args.join(" ")}`);
    const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: false });
    if (r.status !== 0) {
        console.error(`Command failed: ${cmd} ${args.join(" ")}`);
        process.exit(r.status ?? 1);
    }
}

function requireDir(p: string, label: string) {
    if (!existsSync(p)) {
        console.error(`Missing ${label} at: ${p}`);
        process.exit(1);
    }
}

function resolveProfiles(): string[] {
    const args = process.argv.slice(2);
    const idx = args.indexOf("--profile");
    if (idx !== -1) {
        const profile = args[idx + 1];
        if (!profile || !/^[a-zA-Z0-9_-]+$/.test(profile)) {
            console.error("Invalid --profile name.");
            process.exit(1);
        }
        return [profile];
    }
    const apiKeysDir = resolve(root, "apikeys");
    if (!existsSync(apiKeysDir)) {
        console.error(`Missing apikeys/ directory at: ${apiKeysDir}`);
        process.exit(1);
    }
    const profiles = readdirSync(apiKeysDir)
        .filter(f => f.endsWith(".json"))
        .map(f => f.slice(0, -".json".length))
        .filter(p => /^[a-zA-Z0-9_-]+$/.test(p));
    if (profiles.length === 0) {
        console.error("No profile files found in apikeys/.");
    }
    return profiles.sort((a, b) => {
        if (a === "release") return 1;
        if (b === "release") return -1;
        return 0;
    });
}

function installerBaseName(profile: string): string {
    return profile === "release"
        ? `kuumoapp-avalonia_${version}-setup`
        : `kuumoapp-avalonia_${profile}_${version}-setup`;
}

// 1) Backend bundle + native DLLs (profile-independent)
const buildDir = resolve(root, "build");
const binDir = resolve(buildDir, "bin");
const backendJs = resolve(buildDir, "backend.js");
const publishDir = resolve(buildDir, "avalonia-publish");

if (useCache && existsSync(backendJs) && existsSync(publishDir)) {
    console.log("\n Skipping profile-independent builds (--cached, outputs exist)");
} else {
    run("bun", ["run", "build:prod"]);
    requireDir(buildDir, "backend build output");

    // 2) Publish the Avalonia app (framework-dependent .NET — no WASDK)
    rmSync(publishDir, { recursive: true, force: true });
    run("dotnet", [
        "publish",
        resolve(root, "app-avalonia", "KuumoApp", "KuumoApp.csproj"),
        "-c", "Release",
        "-r", "win-x64",
        "-o", publishDir,
    ]);
    requireDir(publishDir, "dotnet publish output");

    // 2b) Ensure Assets land in the publish output (icon stamping needs them)
    const assetsSrc = resolve(root, "app-avalonia", "KuumoApp", "Assets");
    const assetsDst = resolve(publishDir, "Assets");
    if (existsSync(assetsSrc)) {
        cpSync(assetsSrc, assetsDst, { recursive: true });
    }
}

const iscc = findIscc();
if (!iscc) {
    console.error("ISCC.exe not found. Install Inno Setup 6 and retry, or cancel.");
    process.exit(1);
}

const profiles = resolveProfiles();
const artifactsDir = resolve(root, "artifacts");
mkdirSync(artifactsDir, { recursive: true });

for (const profile of profiles) {
    if (profile === "discord") continue;
    console.log(`\n===== Packaging profile: ${profile} =====`);
    run("bun", ["./scripts/encrypt-credentials.ts", "--profile", profile]);

    // 3) Assemble payload — flat layout, no launcher
    //    Root holds the Avalonia exe + backend + include + data + Assets
    const pkg = resolve(buildDir, "avalonia-package");
    rmSync(pkg, { recursive: true, force: true });
    mkdirSync(pkg, { recursive: true });

    // Copy publish output (the Avalonia exe + managed DLLs)
    for (const entry of readdirSync(publishDir)) {
        if (entry === "KuumoApp.pdb") continue;
        cpSync(resolve(publishDir, entry), resolve(pkg, entry), { recursive: true });
    }

    // backend/ — JS bundle
    const backendDir = resolve(pkg, "backend");
    mkdirSync(backendDir, { recursive: true });
    copyFileSync(backendJs, resolve(backendDir, "index.js"));

    // bun.exe at root
    const bunExeSrc = resolve(root, "bin", "bun.exe");
    const bunExePath = existsSync(bunExeSrc)
        ? bunExeSrc
        : (() => {
            const r = spawnSync("where", ["bun"], { encoding: "utf8" });
            if (r.status !== 0 || !r.stdout?.trim()) {
                console.error("bun.exe not found in PATH or bin/");
                process.exit(1);
            }
            const candidates = r.stdout.trim().split(/\r?\n/).filter(Boolean);
            const MIN_BUN_SIZE = 80 * 1024 * 1024;
            const resolved = candidates
                .map(p => ({ path: p.trim(), size: (() => { try { return statSync(p.trim()).size } catch { return 0 } })() }))
                .filter(c => c.size >= MIN_BUN_SIZE)
                .sort((a, b) => b.size - a.size)[0];
            if (!resolved) {
                console.error(`No valid bun.exe found (tried ${candidates.join(", ")})`);
                process.exit(1);
            }
            return resolved.path;
        })();

    // readFileSync + writeFileSync: full copy of running exe
    const bunDest = resolve(pkg, "bun.exe");
    writeFileSync(bunDest, readFileSync(bunExePath));
    const bunSize = statSync(bunDest).size;
    if (bunSize < 1024 * 1024) {
        console.error(`bun.exe copy failed: only ${bunSize} bytes (expected ~85MB)`);
        process.exit(1);
    }

    // include/ — native libs (dlopen'd by bun from CWD = include dir)
    const includeDir = resolve(pkg, "include");
    mkdirSync(includeDir, { recursive: true });
    for (const dll of readdirSync(binDir)) {
        copyFileSync(resolve(binDir, dll), resolve(includeDir, dll));
    }

    // data/system.json — encrypted credentials
    const dataDir = resolve(pkg, "data");
    mkdirSync(dataDir, { recursive: true });
    requireDir(resolve(root, "data", "system.json"), "data/system.json");
    copyFileSync(resolve(root, "data", "system.json"), resolve(dataDir, "system.json"));

    console.log(`Payload assembled at ${pkg}`);

    // 4) Inno Setup compile
    run(iscc, [
        resolve(root, "setup-avalonia.iss"),
        `/DMyAppVersion=${version}`,
        `/DMyAppBaseName=${installerBaseName(profile)}`,
    ]);
    requireDir(resolve(artifactsDir, `${installerBaseName(profile)}.exe`), "setup.exe output");
}

console.log(`\nDone: ${profiles.map(p => `${installerBaseName(p)}.exe`).join(", ")}`);

function findIscc(): string | null {
    if (process.env["ISCC"]) return process.env["ISCC"]!;
    const roots = [
        process.env["ProgramFiles(x86)"],
        process.env["ProgramFiles"],
        process.env["LOCALAPPDATA"] ? resolve(process.env["LOCALAPPDATA"], "Programs") : null,
    ];
    for (const rootScan of roots) {
        if (!rootScan) continue;
        const candidate = resolve(rootScan, "Inno Setup 6", "ISCC.exe");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}
