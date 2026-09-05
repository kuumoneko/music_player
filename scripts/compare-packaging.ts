// Compares WinUI and Avalonia packaging speed side-by-side.
// Runs both full pipelines and reports step-level timing.
//
// Usage:
//   bun run compare-packaging                     -> all profiles
//   bun run compare-packaging --profile myown     -> single profile
//   bun run compare-packaging --cached            -> skip shared builds
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

function timed(label: string, fn: () => void): number {
    console.log(`\n--- ${label} ---`);
    const start = performance.now();
    fn();
    const elapsed = (performance.now() - start) / 1000;
    console.log(`  ${label} took ${elapsed.toFixed(1)}s`);
    return elapsed;
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

function winuiInstallerBaseName(profile: string): string {
    return profile === "release" ? `kuumoapp_${version}-setup` : `kuumoapp_${profile}_${version}-setup`;
}

function avaloniaInstallerBaseName(profile: string): string {
    return profile === "release" ? `kuumoapp-avalonia_${version}-setup` : `kuumoapp-avalonia_${profile}_${version}-setup`;
}

const PUBLISH_TRIM = new Set([
    "onnxruntime.dll", "DirectML.dll", "Microsoft.ML.OnnxRuntime.dll",
    "System.Numerics.Tensors.dll", "Microsoft.Windows.AI.MachineLearning.dll",
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
    "Microsoft.Windows.ApplicationModel.Background.Projection.dll",
    "Microsoft.Windows.ApplicationModel.Background.UniversalBGTask.dll",
    "Microsoft.Windows.ApplicationModel.WindowsAppRuntime.Projection.dll",
    "Microsoft.Windows.AppLifecycle.Projection.dll",
    "Microsoft.Windows.System.Power.Projection.dll",
    "Microsoft.Windows.System.Projection.dll",
    "Microsoft.Windows.Storage.Pickers.Projection.dll",
    "Microsoft.Windows.Storage.Projection.dll",
    "Microsoft.Graphics.Imaging.Projection.dll",
    "Microsoft.Web.WebView2.Core.dll",
    "Microsoft.Web.WebView2.Core.Projection.dll",
    "WebView2Loader.dll",
]);

// --- Shared paths ---
const buildDir = resolve(root, "build");
const binDir = resolve(buildDir, "bin");
const backendJs = resolve(buildDir, "backend.js");
const winuiPublishDir = resolve(buildDir, "publish");
const avaloniaPublishDir = resolve(buildDir, "avalonia-publish");
const launcherDir = resolve(buildDir, "launcher");
const artifactsDir = resolve(root, "artifacts");

const iscc = findIscc();
if (!iscc) {
    console.error("ISCC.exe not found. Install Inno Setup 6 and retry.");
    process.exit(1);
}

const profiles = resolveProfiles();
mkdirSync(artifactsDir, { recursive: true });

// --- Results storage ---
interface StepResult { winui: number; avalonia: number; }
const results: Record<string, StepResult> = {};

const buildCached = useCache && existsSync(backendJs)
    && existsSync(winuiPublishDir)
    && existsSync(resolve(launcherDir, "KuumoApp.exe"))
    && existsSync(avaloniaPublishDir);

// === Phase 1: Backend build (shared) ===
if (buildCached) {
    console.log("\nSkipping shared builds (--cached, outputs exist)");
    results["Backend build"] = { winui: 0, avalonia: 0 };
} else {
    const t = timed("Backend build", () => {
        run("bun", ["run", "build:prod"]);
        requireDir(buildDir, "backend build output");
    });
    results["Backend build"] = { winui: t, avalonia: t };
}

// === Phase 2: dotnet publish ===
if (!buildCached) {
    const winuiPublish = timed("dotnet publish (WinUI app)", () => {
        rmSync(winuiPublishDir, { recursive: true, force: true });
        run("dotnet", [
            "publish", resolve(root, "app-winui", "KuumoApp", "KuumoApp.csproj"),
            "-c", "Release", "-r", "win-x64", "-o", winuiPublishDir,
            "-p:WindowsAppSDKSelfContained=false",
        ], resolve(root, "app-winui"));
        requireDir(winuiPublishDir, "WinUI publish output");
        cpSync(resolve(root, "app-winui", "KuumoApp", "Assets"), resolve(winuiPublishDir, "Assets"), { recursive: true });
    });
    results["dotnet publish (app)"] = { winui: winuiPublish, avalonia: 0 };

    const winuiLauncher = timed("dotnet publish (WinUI launcher)", () => {
        rmSync(launcherDir, { recursive: true, force: true });
        run("dotnet", [
            "publish", resolve(root, "app-winui", "Launcher", "Launcher.csproj"),
            "-c", "Release", "-o", launcherDir,
        ], resolve(root, "app-winui"));
    });
    results["dotnet publish (launcher)"] = { winui: winuiLauncher, avalonia: 0 };

    const avaloniaPublish = timed("dotnet publish (Avalonia app)", () => {
        rmSync(avaloniaPublishDir, { recursive: true, force: true });
        run("dotnet", [
            "publish", resolve(root, "app-avalonia", "KuumoApp", "KuumoApp.csproj"),
            "-c", "Release", "-r", "win-x64", "-o", avaloniaPublishDir,
        ]);
        requireDir(avaloniaPublishDir, "Avalonia publish output");
        const assetsSrc = resolve(root, "app-avalonia", "KuumoApp", "Assets");
        if (existsSync(assetsSrc)) {
            cpSync(assetsSrc, resolve(avaloniaPublishDir, "Assets"), { recursive: true });
        }
    });
    results["dotnet publish (app)"].avalonia = avaloniaPublish;
    results["dotnet publish (launcher)"].avalonia = 0;
} else {
    results["dotnet publish (app)"] = { winui: 0, avalonia: 0 };
    results["dotnet publish (launcher)"] = { winui: 0, avalonia: 0 };
}

// === Per-profile: encrypt + assemble + ISCC ===
const profileTimings: Record<string, { winui: StepResult; avalonia: StepResult }> = {};

for (const profile of profiles) {
    if (profile === "discord") continue;
    console.log(`\n===== Profile: ${profile} =====`);

    // Encrypt credentials (shared)
    const encT = timed(`Encrypt credentials (${profile})`, () => {
        run("bun", ["./scripts/encrypt-credentials.ts", "--profile", profile]);
    });

    // --- WinUI assembly ---
    const winuiAssemble = timed(`WinUI assemble (${profile})`, () => {
        const pkg = resolve(buildDir, "package");
        rmSync(pkg, { recursive: true, force: true });
        mkdirSync(pkg, { recursive: true });

        const appDir = resolve(pkg, "app");
        mkdirSync(appDir, { recursive: true });
        for (const entry of readdirSync(winuiPublishDir)) {
            if (entry === "KuumoApp.pdb") continue;
            if (PUBLISH_TRIM.has(entry)) continue;
            cpSync(resolve(winuiPublishDir, entry), resolve(appDir, entry), { recursive: true });
        }

        const appBackendDir = resolve(appDir, "backend");
        mkdirSync(appBackendDir, { recursive: true });
        copyFileSync(backendJs, resolve(appBackendDir, "index.js"));

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
        writeFileSync(resolve(appDir, "bun.exe"), readFileSync(bunExePath));

        const includeDir = resolve(appDir, "include");
        mkdirSync(includeDir, { recursive: true });
        for (const dll of readdirSync(binDir)) {
            copyFileSync(resolve(binDir, dll), resolve(includeDir, dll));
        }

        const dataDir = resolve(appDir, "data");
        mkdirSync(dataDir, { recursive: true });
        copyFileSync(resolve(root, "data", "system.json"), resolve(dataDir, "system.json"));

        requireDir(resolve(launcherDir, "KuumoApp.exe"), "launcher exe");
        for (const entry of readdirSync(launcherDir)) {
            if (entry.endsWith(".pdb")) continue;
            copyFileSync(resolve(launcherDir, entry), resolve(pkg, entry));
        }
    });

    // --- WinUI ISCC ---
    const winuiIscc = timed(`WinUI ISCC (${profile})`, () => {
        const baseName = winuiInstallerBaseName(profile);
        run(iscc, [resolve(root, "setup.iss"), `/DMyAppVersion=${version}`, `/DMyAppBaseName=${baseName}`]);
        requireDir(resolve(artifactsDir, `${baseName}.exe`), "WinUI setup.exe");
    });

    // --- Avalonia assembly ---
    const avaloniaAssemble = timed(`Avalonia assemble (${profile})`, () => {
        const pkg = resolve(buildDir, "avalonia-package");
        rmSync(pkg, { recursive: true, force: true });
        mkdirSync(pkg, { recursive: true });

        for (const entry of readdirSync(avaloniaPublishDir)) {
            if (entry === "KuumoApp.pdb") continue;
            cpSync(resolve(avaloniaPublishDir, entry), resolve(pkg, entry), { recursive: true });
        }

        const backendDir = resolve(pkg, "backend");
        mkdirSync(backendDir, { recursive: true });
        copyFileSync(backendJs, resolve(backendDir, "index.js"));

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
        writeFileSync(resolve(pkg, "bun.exe"), readFileSync(bunExePath));

        const includeDir = resolve(pkg, "include");
        mkdirSync(includeDir, { recursive: true });
        for (const dll of readdirSync(binDir)) {
            copyFileSync(resolve(binDir, dll), resolve(includeDir, dll));
        }

        const dataDir = resolve(pkg, "data");
        mkdirSync(dataDir, { recursive: true });
        copyFileSync(resolve(root, "data", "system.json"), resolve(dataDir, "system.json"));
    });

    // --- Avalonia ISCC ---
    const avaloniaIscc = timed(`Avalonia ISCC (${profile})`, () => {
        const baseName = avaloniaInstallerBaseName(profile);
        run(iscc, [resolve(root, "setup-avalonia.iss"), `/DMyAppVersion=${version}`, `/DMyAppBaseName=${baseName}`]);
        requireDir(resolve(artifactsDir, `${baseName}.exe`), "Avalonia setup.exe");
    });

    profileTimings[profile] = {
        winui: { avalonia: encT + avaloniaAssemble + avaloniaIscc, winui: encT + winuiAssemble + winuiIscc },
        avalonia: { avalonia: encT + avaloniaAssemble + avaloniaIscc, winui: 0 },
    };
}

// === Print comparison table ===
console.log("\n");
console.log("=== Packaging Speed Comparison ===\n");

const pad = (s: string, w: number) => s.padEnd(w);
const padL = (s: string, w: number) => s.padStart(w);

const W = 32;
const C = 12;

console.log(`${pad("Phase", W)} ${padL("WinUI", C)} ${padL("Avalonia", C)} ${padL("Delta", C)}`);
console.log("─".repeat(W + C * 3 + 3));

function fmt(s: number): string {
    return s === 0 ? "—" : `${s.toFixed(1)}s`;
}

function fmtDelta(w: number, a: number): string {
    if (w === 0 && a === 0) return "—";
    if (a === 0) return "—";
    if (w === 0) return "—";
    const d = a - w;
    const sign = d > 0 ? "+" : "";
    return `${sign}${d.toFixed(1)}s`;
}

// Shared phases
for (const key of ["Backend build", "dotnet publish (app)", "dotnet publish (launcher)"]) {
    const r = results[key];
    if (!r) continue;
    console.log(`${pad(key, W)} ${padL(fmt(r.winui), C)} ${padL(fmt(r.avalonia), C)} ${padL(fmtDelta(r.winui, r.avalonia), C)}`);
}

console.log("─".repeat(W + C * 3 + 3));

// Per-profile totals
let totalWinui = 0;
let totalAvalonia = 0;

for (const profile of profiles) {
    if (profile === "discord") continue;
    const pt = profileTimings[profile];
    if (!pt) continue;

    // WinUI profile total = encrypt + assemble + ISCC
    const winuiProfileTotal = results["Backend build"]!.winui
        + results["dotnet publish (app)"]!.winui
        + results["dotnet publish (launcher)"]!.winui
        + pt.winui.winui;

    // Avalonia profile total = encrypt + assemble + ISCC
    const avaloniaProfileTotal = results["Backend build"]!.avalonia
        + results["dotnet publish (app)"]!.avalonia
        + pt.avalonia.avalonia;

    totalWinui += winuiProfileTotal;
    totalAvalonia += avaloniaProfileTotal;

    console.log(`${pad(`Total (${profile})`, W)} ${padL(fmt(winuiProfileTotal), C)} ${padL(fmt(avaloniaProfileTotal), C)} ${padL(fmtDelta(winuiProfileTotal, avaloniaProfileTotal), C)}`);
}

console.log("─".repeat(W + C * 3 + 3));
console.log(`${pad("GRAND TOTAL", W)} ${padL(fmt(totalWinui), C)} ${padL(fmt(totalAvalonia), C)} ${padL(fmtDelta(totalWinui, totalAvalonia), C)}`);

// Installer sizes
console.log("\n--- Installer sizes ---");
for (const profile of profiles) {
    if (profile === "discord") continue;
    const winuiExe = resolve(artifactsDir, `${winuiInstallerBaseName(profile)}.exe`);
    const avaloniaExe = resolve(artifactsDir, `${avaloniaInstallerBaseName(profile)}.exe`);
    const winuiSize = existsSync(winuiExe) ? statSync(winuiExe).size : 0;
    const avaloniaSize = existsSync(avaloniaExe) ? statSync(avaloniaExe).size : 0;
    const fmtSize = (b: number) => b === 0 ? "—" : `${(b / 1024 / 1024).toFixed(1)}MB`;
    console.log(`  ${profile}: WinUI ${fmtSize(winuiSize)}  Avalonia ${fmtSize(avaloniaSize)}`);
}

console.log("\nDone.");
