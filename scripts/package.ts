// Builds the WinUI + Bun payload, assembles a setup.exe with Inno Setup,
// and writes the update manifest that scripts/release.ts reads.
//
// Pipeline (per profile):
//   encrypt-credentials --profile X -> data/system.json with profile X's keys
//   bun run build:prod              -> build/backend.js + build/*.dll
//   copy bun.exe + backend.js       -> build/package/app/backend/ (shared Bun runtime + JS bundle)
//   dotnet publish                  -> WinUI publish output (framework-dependent WinAppSDK)
//   dotnet publish launcher         -> build/launcher/ (single-file root launcher exe)
//   assemble                        -> build/package/ (launcher KuumoApp.exe + app/ payload)
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
//   bun run package --cached        -> skips profile-independent builds if outputs exist (CI)
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

// Framework-dependent Windows App SDK deployment, kept FLAT inside app\: the
// .NET host resolves every managed assembly strictly through KuumoApp.deps.json
// paths relative to app\KuumoApp.exe (verified via COREHOST_TRACE — it strips
// subfolder prefixes from package entries, probes nothing else, and
// Microsoft.WinUI is loaded at JIT time before Main's AssemblyResolve handler
// can attach). The install root only holds the launcher (see
// app-winui/Launcher) plus the app\ folder, so the proven flat layout stays
// untouched. The backend's native libs (dlopen'd by bun.exe from its CWD)
// live in app\include\.

// WASDK package files with no code references (verified: no C#/Bun usage of
// onnx/AI/WebView2/notifications/widgets/etc.). Skipped from the payload
// entirely. Keep in sync with the [InstallDelete] block in setup.iss.
// Microsoft.InteractiveExperiences.Projection.dll is deliberately NOT trimmed:
// unpackaged framework-dependent WinUI apps need it at XAML startup (removing
// it crashes with 0xC000027B — verified by bisection).
const PUBLISH_TRIM = new Set([
    "onnxruntime.dll",
    "DirectML.dll",
    "Microsoft.ML.OnnxRuntime.dll",
    "System.Numerics.Tensors.dll",
    "Microsoft.Windows.AI.MachineLearning.dll",
    "Microsoft.Windows.AI.ContentSafety.Projection.dll",
    "Microsoft.Windows.AI.Foundation.Projection.dll",
    "Microsoft.Windows.AI.Imaging.Projection.dll",
    "Microsoft.Windows.AI.MachineLearning.Projection.dll",
    "Microsoft.Windows.AI.Projection.dll",
    "Microsoft.Windows.AI.Text.Projection.dll",
    "Microsoft.Windows.AI.Video.Projection.dll",
    "Microsoft.Windows.Widgets.Projection.dll",
    "Microsoft.Windows.AppNotifications.Projection.dll",
    "Microsoft.Windows.AppNotifications.Builder.Projection.dll",
    "Microsoft.Windows.PushNotifications.Projection.dll",
    "Microsoft.Windows.BadgeNotifications.Projection.dll",
    "Microsoft.Windows.Media.Capture.Projection.dll",
    "Microsoft.Windows.Management.Deployment.Projection.dll",
    "Microsoft.Windows.Security.AccessControl.Projection.dll",
    "Microsoft.Graphics.Imaging.Projection.dll",
    "Microsoft.Web.WebView2.Core.dll",
    "Microsoft.Web.WebView2.Core.Projection.dll",
    "WebView2Loader.dll",
]);

// Runtime prerequisites are installed by the setup.exe at install time via
// scripts/install-prereqs.ps1 — nothing to download or stage here.

// 1) Backend bundle + native DLLs (profile-independent)
const buildDir = resolve(root, "build");
const binDir = resolve(buildDir, "bin");
const backendJs = resolve(buildDir, "backend.js");
const publishDir = resolve(root, "build", "publish");
const launcherDir = resolve(buildDir, "launcher");

if (useCache && existsSync(backendJs) && existsSync(publishDir) && existsSync(resolve(launcherDir, "KuumoApp.exe"))) {
    console.log("\n Skipping profile-independent builds (--cached, outputs exist)");
} else {
    run("bun", ["run", "build:prod"]);
    requireDir(buildDir, "backend build output");

    // 2) Publish the WinUI app + launcher in parallel (independent projects, no shared output)
    run("dotnet", ["restore", resolve(root, "app-winui", "KuumoApp", "KuumoApp.csproj"), "-r", "win-x64"], resolve(root, "app-winui"));
    rmSync(publishDir, { recursive: true, force: true });
    rmSync(launcherDir, { recursive: true, force: true });

    const kuumoArgs = ["publish", resolve(root, "app-winui", "KuumoApp", "KuumoApp.csproj"), "-c", "Release", "-r", "win-x64", "-o", publishDir, "--no-restore", "-p:WindowsAppSDKSelfContained=false", "-p:PublishReadyToRun=false", "-p:DebugType=none", "-p:DebugSymbols=false"];
    const launcherArgs = ["publish", resolve(root, "app-winui", "Launcher", "Launcher.csproj"), "-c", "Release", "-o", launcherDir];
    console.log(`\n> dotnet ${kuumoArgs.join(" ")}`);
    console.log(`> dotnet ${launcherArgs.join(" ")}\n`);
    const kuumo = Bun.spawn(["dotnet", ...kuumoArgs], { cwd: resolve(root, "app-winui"), stdio: ["inherit", "inherit", "inherit"] });
    const launcher = Bun.spawn(["dotnet", ...launcherArgs], { cwd: resolve(root, "app-winui"), stdio: ["inherit", "inherit", "inherit"] });
    const [kuumoExit, launcherExit] = await Promise.all([kuumo.exited, launcher.exited]);
    if (kuumoExit !== 0) { console.error(`KuumoApp publish failed (exit ${kuumoExit})`); process.exit(kuumoExit ?? 1); }
    if (launcherExit !== 0) { console.error(`Launcher publish failed (exit ${launcherExit})`); process.exit(launcherExit ?? 1); }

    requireDir(publishDir, "dotnet publish output");
    requireDir(launcherDir, "launcher publish output");
    run("dotnet", ["run", "--project", resolve(root, "scripts", "StampIcon", "StampIcon.csproj"), "--", resolve(publishDir, "KuumoApp.exe"), resolve(root, "app-winui", "KuumoApp", "Assets", "AppIcon.ico")], root);

    // 2b) Ensure the app's Assets (titlebar/tray/SMTC icons) land in the payload —
    // the publish pipeline can drop Content items on incremental runs.
    cpSync(resolve(root, "app-winui", "KuumoApp", "Assets"), resolve(publishDir, "Assets"), { recursive: true });
}

// 2d) Runtime prerequisites are NOT bundled — setup.iss downloads and installs
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
    if (profile === "discord") continue;
    console.log(`\n===== Packaging profile: ${profile} =====`);
    run("bun", ["./scripts/encrypt-credentials.ts", "--profile", profile]);

    // 3) Assemble payload: launcher at the package root, full app payload in
    // app\ (the host resolves every managed assembly from deps.json paths
    // relative to app\KuumoApp.exe, so the flat layout inside app\ is the same
    // as before — only the install root gets a launcher in front of it).
    const pkg = resolve(buildDir, "package");
    rmSync(pkg, { recursive: true, force: true });
    mkdirSync(pkg, { recursive: true });

    const appDir = resolve(pkg, "app");
    mkdirSync(appDir, { recursive: true });
    for (const entry of readdirSync(publishDir)) {
        if (entry === "KuumoApp.pdb") continue; // no debug symbols in the payload
        if (PUBLISH_TRIM.has(entry)) continue; // unused WASDK files, see PUBLISH_TRIM
        cpSync(resolve(publishDir, entry), resolve(appDir, entry), { recursive: true });
    }

    // app\backend\ — JS bundle only
    const appBackendDir = resolve(appDir, "backend");
    mkdirSync(appBackendDir, { recursive: true });
    copyFileSync(backendJs, resolve(appBackendDir, "index.js"));

    // bun.exe at app\ root (same dir as KuumoApp.exe)
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

    // copyFileSync uses CopyFileEx which only copies mapped pages of the running exe → stub.
    // readFileSync + writeFileSync reads the full content via ReadFile and writes a brand-new file.
    const bunDest = resolve(appDir, "bun.exe");
    writeFileSync(bunDest, readFileSync(bunExePath));
    const bunSize = statSync(bunDest).size;
    if (bunSize < 1024 * 1024) {
        console.error(`bun.exe copy failed: only ${bunSize} bytes (expected ~85MB)`);
        process.exit(1);
    }

    // app\include\ holds the backend's native libs (dlopen'd from CWD = include dir)
    const includeDir = resolve(appDir, "include");
    mkdirSync(includeDir, { recursive: true });
    for (const dll of readdirSync(binDir)) {
        copyFileSync(resolve(binDir, dll), resolve(includeDir, dll));
    }

    // app\data\system.json — shipped credentials (encrypted), read as {app}\app\data\system.json
    const dataDir = resolve(appDir, "data");
    mkdirSync(dataDir, { recursive: true });
    requireDir(resolve(root, "data", "system.json"), "data/system.json");
    copyFileSync(resolve(root, "data", "system.json"), resolve(dataDir, "system.json"));

    // 3b) Root launcher: copy from cached publish output
    requireDir(resolve(launcherDir, "KuumoApp.exe"), "launcher exe");
    for (const entry of readdirSync(launcherDir)) {
        if (entry.endsWith(".pdb")) continue;
        copyFileSync(resolve(launcherDir, entry), resolve(pkg, entry));
    }

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