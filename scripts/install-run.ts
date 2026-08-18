// Builds, packages, installs, and launches KuumoApp against the previously
// installed location (registry -> running process -> default), for local
// release testing.
//
// Pipeline:
//   detect previous install dir
//   kill running app/backend (KuumoApp, dev bun backend.js, release backend.exe)
//   bun run package --profile <profile>   (already runs build:prod, see package.ts)
//   setup.exe /VERYSILENT /DIR=<detected>
//   launch <detected>\KuumoApp.exe (detached)
//
// Usage:
//   bun run install-run                  -> profile myown
//   bun run install-run --profile X
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function profileArg(): string {
    const args = process.argv.slice(2);
    const idx = args.indexOf("--profile");
    if (idx !== -1) {
        const profile = args[idx + 1];
        if (!profile || !/^[a-zA-Z0-9_-]+$/.test(profile)) {
            console.error("Invalid --profile name.");
            process.exit(1);
        }
        return profile;
    }
    return "myown";
}

function run(cmd: string, args: string[], cwd: string = root) {
    console.log(`\n> ${cmd} ${args.join(" ")}`);
    const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: false });
    if (r.status !== 0) {
        console.error(`Command failed: ${cmd} ${args.join(" ")}`);
        process.exit(r.status ?? 1);
    }
}

// Kills the running app and its backends. Scope matters:
//   - KuumoApp by name: covers installed + dev app exes (both are KuumoApp.exe)
//   - bun only when backend.js is on the command line: dev backend; unrelated
//     bun processes (e.g. other apps built on Bun) are left alone
//   - backend.exe only when KuumoApp is on the command line: release backend
// Order: app first, then backends — otherwise BunHostService.OnExited
// auto-restarts the backend while the app is still alive.
const KILL_SCRIPT = [
    "Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | Stop-Process -Force",
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^bun' -and $_.CommandLine -match 'backend\\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^backend' -and $_.CommandLine -match 'KuumoApp' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    "exit 0",
].join("; ");

function killAll() {
    const r = spawnSync("powershell", ["-NoProfile", "-Command", KILL_SCRIPT], { stdio: "inherit" });
    if (r.status !== 0) {
        console.error("Failed to kill running KuumoApp processes.");
        process.exit(r.status ?? 1);
    }
}

// Detection order: registry uninstall key (InstallLocation), running process
// (strip trailing \app — the real apphost lives at {root}\app\), then the
// setup.iss default.
const DETECT_SCRIPT = [
    "$hives = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall')",
    "foreach ($hive in $hives) {",
    "  Get-ChildItem $hive -ErrorAction SilentlyContinue | ForEach-Object {",
    "    $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue",
    "    if ($p.DisplayName -match '^KuumoApp' -and $p.InstallLocation) { $p.InstallLocation; exit 0 }",
    "  }",
    "}",
    "$proc = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'KuumoApp.exe' } | Select-Object -First 1",
    "if ($proc) {",
    "  $dir = Split-Path $proc.ExecutablePath",
    "  if (Split-Path $dir -Leaf -eq 'app') { $dir = Split-Path $dir }",
    "  $dir",
    "  exit 0",
    "}",
    "Write-Output ''",
    "exit 0",
].join("\n");

function detectInstallDir(): string {
    const r = spawnSync("powershell", ["-NoProfile", "-Command", DETECT_SCRIPT], { encoding: "utf8" });
    if (r.status === 0) {
        const dir = r.stdout?.trim();
        if (dir) {
            console.log(`Detected previous install at: ${dir}`);
            return dir;
        }
    }
    const fallback = resolve(process.env["LOCALAPPDATA"] ?? "", "KuumoApp");
    console.log(`No previous install detected, using default: ${fallback}`);
    return fallback;
}

const profile = profileArg();
const installDir = detectInstallDir();
const installer = resolve(root, "artifacts", `kuumoapp_${profile}_${version}-setup.exe`);
const appExe = resolve(installDir, "KuumoApp.exe");

console.log(`\n===== install-run: profile=${profile}, install dir=${installDir} =====`);

killAll();

run("bun", ["run", "package", "--profile", profile]);

if (!existsSync(installer)) {
    console.error(`Installer not found: ${installer}`);
    process.exit(1);
}

// packaging takes minutes and the dev app could be relaunched meanwhile
killAll();

console.log(`\n> ${installer} /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="${installDir}"`);
const install = spawnSync(installer, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", `/DIR=${installDir}`], { stdio: "inherit" });
if (install.status !== 0) {
    console.error(`Installer failed (exit ${install.status ?? "?"}).`);
    process.exit(install.status ?? 1);
}

if (!existsSync(appExe)) {
    console.error(`App exe not found after install: ${appExe}`);
    process.exit(1);
}

console.log(`\nLaunching ${appExe}`);
spawn(appExe, [], {
    cwd: installDir,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
}).unref();

console.log("Done.");