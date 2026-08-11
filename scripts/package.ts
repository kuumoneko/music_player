// Builds the WinUI + Bun payload, assembles a setup.exe with Inno Setup,
// and writes the update manifest that scripts/release.ts reads.
//
// Pipeline (per profile):
//   encrypt-credentials --profile X -> data/system.json with profile X's keys
//   bun run build:prod              -> build/backend.js + build/*.dll
//   bun build --compile             -> build/backend.exe (compiled Bun backend)
//   dotnet publish                  -> WinUI publish output (framework-dependent WinAppSDK)
//   assemble                        -> build/package/ (KuumoApp.exe, backend.exe, include/, data/)
//   ISCC.exe setup.iss              -> artifacts/kuumoapp[_<profile>]_{version}-setup.exe
//   update manifest                 -> artifacts/stable-win-x64-update.json
//
// Runtime prerequisites (.NET Desktop Runtime + Windows App SDK runtime) are
// NOT bundled — setup.iss downloads and installs them at install time via
// scripts/install-prereqs.ps1.
//
// Usage:
//   bun run package                 -> builds ALL profiles found in apikeys/ (myown first, release last)
//   bun run package --profile myown -> builds only that profile (dev testing)
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

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
        process.exit(1);
    }
    // myown first, release last — repo data/system.json ends in the release state
    return profiles.sort((a, b) => {
        if (a === "release") return 1;
        if (b === "release") return -1;
        return 0;
    });
}

function installerBaseName(profile: string): string {
    return profile === "release" ? `kuumoapp_${version}-setup` : `kuumoapp_${profile}_${version}-setup`;
}

// Framework-dependent Windows App SDK deployment: the app folder only keeps
// the files below; every DLL (managed + native) is staged in include\ where
// Program.cs redirects loading. Keep the allowlist in sync with Program.cs.
const PUBLISH_ROOT_ALLOW = new Set([
    "KuumoApp.exe",
    "KuumoApp.dll",
    "KuumoApp.pri",
    "KuumoApp.deps.json",
    "KuumoApp.runtimeconfig.json",
    "Assets",
]);

// Runtime prerequisites are installed by the setup.exe at install time via
// scripts/install-prereqs.ps1 — nothing to download or stage here.

// 1) Backend bundle + native DLLs (profile-independent)
run("bun", ["run", "build:prod"]);
const buildDir = resolve(root, "build");
const binDir = resolve(buildDir, "bin");
requireDir(buildDir, "backend build output");

// 1b) Compile the backend into a standalone exe (release entrypoint at app root)
run("bun", [
    "build",
    "--compile",
    "--target=bun",
    "--minify",
    "--outfile",
    resolve(buildDir, "backend.exe"),
    resolve(root, "src", "bun", "index.ts"),
]);

// 2) Publish the WinUI app (framework-dependent WinAppSDK — the runtime is an
// installer prerequisite, not part of the app folder; profile-independent)
const publishDir = resolve(root, "build", "publish");
rmSync(publishDir, { recursive: true, force: true });
run("dotnet", ["publish", resolve(root, "app-winui", "KuumoApp", "KuumoApp.csproj"), "-c", "Release", "-r", "win-x64", "-o", publishDir, "-p:WindowsAppSDKSelfContained=false"], resolve(root, "app-winui"));
requireDir(publishDir, "dotnet publish output");

// 2b) Ensure the app's Assets (titlebar/tray/SMTC icons) land in the payload —
// the publish pipeline can drop Content items on incremental runs.
cpSync(resolve(root, "app-winui", "KuumoApp", "Assets"), resolve(publishDir, "Assets"), { recursive: true });

// 2c) Runtime prerequisites are NOT bundled — setup.iss downloads and installs
// .NET Desktop Runtime + Windows App SDK runtime at install time via
// scripts/install-prereqs.ps1 (see scripts/install-prereqs.ps1 for the pins).

const iscc = findIscc();
if (!iscc) {
    console.error("ISCC.exe not found. Install Inno Setup 6 and retry, or cancel.");
    process.exit(1);
}

const profiles = resolveProfiles();
const artifactsDir = resolve(root, "artifacts");
mkdirSync(artifactsDir, { recursive: true });

for (const profile of profiles) {
    console.log(`\n===== Packaging profile: ${profile} =====`);
    run("bun", ["./scripts/encrypt-credentials.ts", "--profile", profile]);

    // 3) Assemble payload
    const pkg = resolve(buildDir, "package");
    rmSync(pkg, { recursive: true, force: true });
    mkdirSync(pkg, { recursive: true });

    // Publish output split: allowlisted files stay at root; every DLL/winmd
    // goes to include\ (Program.cs redirects managed + native loading there).
    const includeDir = resolve(pkg, "include");
    mkdirSync(includeDir, { recursive: true });
    for (const entry of readdirSync(publishDir)) {
        if (entry === "KuumoApp.pdb") continue; // no debug symbols in the payload
        const src = resolve(publishDir, entry);
        const dst = PUBLISH_ROOT_ALLOW.has(entry) ? resolve(pkg, entry) : resolve(includeDir, entry);
        cpSync(src, dst, { recursive: true });
    }

    // backend.exe at app root (compiled Bun backend; BunHostService launches it there)
    copyFileSync(resolve(buildDir, "backend.exe"), resolve(pkg, "backend.exe"));

    // include/ also holds the backend's native libs (dlopen'd from CWD = include dir)
    for (const dll of readdirSync(binDir)) {
        copyFileSync(resolve(binDir, dll), resolve(includeDir, dll));
    }

    // data/system.json — shipped credentials (encrypted), read as {app}/data/system.json
    const dataDir = resolve(pkg, "data");
    mkdirSync(dataDir, { recursive: true });
    requireDir(resolve(root, "data", "system.json"), "data/system.json");
    copyFileSync(resolve(root, "data", "system.json"), resolve(dataDir, "system.json"));

    console.log(`Payload assembled at ${pkg}`);

    // 4) Inno Setup compile
    run(iscc, [resolve(root, "setup.iss"), `/DMyAppVersion=${version}`, `/DMyAppBaseName=${installerBaseName(profile)}`]);
    requireDir(resolve(artifactsDir, `${installerBaseName(profile)}.exe`), "setup.exe output");
}

// 5) Update manifest for scripts/release.ts
writeFileSync(
    resolve(artifactsDir, "stable-win-x64-update.json"),
    JSON.stringify({ version }, null, 2),
    "utf8"
);

console.log(`\nDone: ${profiles.map(p => `${installerBaseName(p)}.exe`).join(", ")}`);
console.log(`Manifest: artifacts/stable-win-x64-update.json (v${version})`);

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