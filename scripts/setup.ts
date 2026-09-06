// Post-extraction setup script for the NanaZip SFX installer.
// Called by the SFX module after extraction: bun.exe app\setup.js --install-dir <path> [--seed] [--silent]
//
// Responsibilities:
//   1. Write uninstall.js to install dir (first, so it always exists)
//   2. Install runtime prerequisites (.NET Desktop Runtime + Windows App SDK)
//   3. Seed app data (system.json → app_data.sqlite)
//   4. Create Start Menu + Desktop shortcuts
//   5. Register uninstaller in Windows registry
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync, spawn } from "node:child_process";

// --- Args ---
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : undefined;
}
const hasFlag = (name: string) => args.includes(name);

const installDir = getArg("--install-dir") ?? resolve(process.env["LOCALAPPDATA"] ?? "", "KuumoApp");
const silent = hasFlag("--silent");
const seed = hasFlag("--seed");
const version = getArg("--version") ?? "0.0.0";

const appDir = join(installDir, "app");
const backendDir = join(appDir, "backend");
const bunExe = join(appDir, "bun.exe");
const setupScriptDir = appDir; // setup.js is in app\
const regKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\KuumoApp";

// --- Helpers ---
function log(msg: string) {
    if (!silent) console.log(msg);
}

function runPowerShell(script: string): { ok: boolean; output: string } {
    const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
        encoding: "utf8",
        timeout: 300_000,
    });
    return { ok: r.status === 0, output: (r.stdout ?? "") + (r.stderr ?? "") };
}

function getDirSizeKB(dir: string): number {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        total += entry.isDirectory() ? getDirSizeKB(p) : statSync(p).size;
    }
    return Math.round(total / 1024);
}

// --- 1. Install prerequisites ---
async function installPrereqs() {
    log("Checking runtime prerequisites...");
    const prereqScript = join(setupScriptDir, "install-prereqs.ps1");
    if (existsSync(prereqScript)) {
        const r = spawnSync("powershell.exe", [
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", prereqScript,
        ], { encoding: "utf8", stdio: silent ? "pipe" : "inherit", timeout: 600_000 });
        if (r.status !== 0) {
            console.error("Warning: prerequisite installation had issues (continuing anyway)");
        }
    } else {
        log("  install-prereqs.ps1 not found, skipping prerequisite check");
    }
}

// --- 2. Seed app data ---
function seedAppData() {
    if (!seed) return;
    log("Seeding app data...");
    const dataDir = join(process.env["APPDATA"] ?? "", "KuumoApp");
    if (!existsSync(bunExe)) {
        console.error(`bun.exe not found at ${bunExe}`);
        return;
    }
    const r = spawnSync(bunExe, [
        join(backendDir, "index.js"),
        "--seed",
        "--data-dir", dataDir,
        "--assets", appDir,
    ], { encoding: "utf8", stdio: silent ? "pipe" : "inherit", timeout: 30_000 });
    if (r.status !== 0) {
        console.error("Warning: app data seeding had issues (continuing anyway)");
    }
}

// --- 3. Create shortcuts ---
async function createShortcuts() {
    log("Creating shortcuts...");
    const exePath = join(installDir, "KuumoApp.exe");
    const iconPath = join(appDir, "Assets", "AppIcon.ico");

    // Start Menu shortcut
    const startMenuDir = join(process.env["APPDATA"] ?? "", "Microsoft", "Windows", "Start Menu", "Programs");
    const startMenuLink = join(startMenuDir, "KuumoApp.lnk");
    const psCreateShortcut = `
        $WshShell = New-Object -ComObject WScript.Shell
        $shortcut = $WshShell.CreateShortcut('${startMenuLink.replace(/\\/g, "\\\\")}')
        $shortcut.TargetPath = '${exePath.replace(/\\/g, "\\\\")}'
        $shortcut.WorkingDirectory = '${installDir.replace(/\\/g, "\\\\")}'
        ${existsSync(iconPath) ? `$shortcut.IconLocation = '${iconPath.replace(/\\/g, "\\\\")}'` : ""}
        $shortcut.Save()
    `;
    const r1 = runPowerShell(psCreateShortcut);
    if (!r1.ok) console.error(`  Failed to create Start Menu shortcut: ${r1.output}`);

    // Desktop shortcut
    const desktopLink = join(process.env["USERPROFILE"] ?? "", "Desktop", "KuumoApp.lnk");
    const psDesktopShortcut = `
        $WshShell = New-Object -ComObject WScript.Shell
        $shortcut = $WshShell.CreateShortcut('${desktopLink.replace(/\\/g, "\\\\")}')
        $shortcut.TargetPath = '${exePath.replace(/\\/g, "\\\\")}'
        $shortcut.WorkingDirectory = '${installDir.replace(/\\/g, "\\\\")}'
        ${existsSync(iconPath) ? `$shortcut.IconLocation = '${iconPath.replace(/\\/g, "\\\\")}'` : ""}
        $shortcut.Save()
    `;
    const r2 = runPowerShell(psDesktopShortcut);
    if (!r2.ok) console.error(`  Failed to create Desktop shortcut: ${r2.output}`);
}

// --- 4. Register uninstaller ---
function registerUninstaller() {
    log("Registering uninstaller...");
    const uninstallExe = join(installDir, "uninstall.js");

    const commands = [
        `New-Item -Path "Registry::${regKey}" -Force | Out-Null`,
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "DisplayName" -Value "KuumoApp"`,
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "DisplayVersion" -Value "${getVersion()}"`,
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "Publisher" -Value "kuumoneko"`,
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "InstallLocation" -Value "${installDir.replace(/\\/g, "\\\\")}"`,
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "NoModify" -Value 1 -Type DWord`,
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "NoRepair" -Value 1 -Type DWord`,
    ];

    // UninstallString (interactive — shows console)
    const uninstallCmd = `"${bunExe}" "${uninstallExe}"`;
    commands.push(
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "UninstallString" -Value ${JSON.stringify(uninstallCmd)}`
    );

    // QuietUninstallString (silent — for Settings/CLI)
    const quietCmd = `"${bunExe}" "${uninstallExe}" --silent`;
    commands.push(
        `Set-ItemProperty -Path "Registry::${regKey}" -Name "QuietUninstallString" -Value ${JSON.stringify(quietCmd)}`
    );

    const r = runPowerShell(commands.join("; "));
    if (!r.ok) console.error(`  Failed to register uninstaller: ${r.output}`);
}

function getVersion(): string {
    return version;
}

// --- 5. Write uninstall script ---
function writeUninstallScript() {
    log("Writing uninstall script...");
    const uninstallJs = join(installDir, "uninstall.js");
    const script = `// Auto-generated uninstaller for KuumoApp
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const installDir = ${JSON.stringify(installDir)};
const silent = process.argv.includes("--silent");

if (!silent) {
    console.log("KuumoApp will be uninstalled from: " + installDir);
}

// Remove Start Menu shortcut
const startMenuLink = join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs", "KuumoApp.lnk");
if (existsSync(startMenuLink)) rmSync(startMenuLink);

// Remove Desktop shortcut
const desktopLink = join(process.env.USERPROFILE ?? "", "Desktop", "KuumoApp.lnk");
if (existsSync(desktopLink)) rmSync(desktopLink);

// Remove registry entry
const regKey = "HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\KuumoApp";
spawnSync("reg.exe", ["delete", regKey, "/f"], { stdio: "pipe" });

// Remove install directory (self-delete last)
console.log("Removing " + installDir + "...");
try {
    rmSync(installDir, { recursive: true, force: true });
} catch {
    console.error("Some files could not be removed. Please delete manually.");
}

console.log("KuumoApp has been uninstalled.");
`;
    writeFileSync(uninstallJs, script, "utf8");
}

// --- Main ---
async function main() {
    log(`\nKuumoApp Setup`);
    log(`Install directory: ${installDir}\n`);

    // Ensure install dir exists
    mkdirSync(installDir, { recursive: true });

    // Write uninstall script FIRST so it always exists even if later steps fail
    try { writeUninstallScript(); } catch (e) { console.error(`Warning: failed to write uninstall script: ${e instanceof Error ? e.message : String(e)}`); }

    try { await installPrereqs(); } catch (e) { console.error(`Warning: prerequisite install failed: ${e instanceof Error ? e.message : String(e)}`); }
    try { seedAppData(); } catch (e) { console.error(`Warning: seeding failed: ${e instanceof Error ? e.message : String(e)}`); }
    try { await createShortcuts(); } catch (e) { console.error(`Warning: shortcut creation failed: ${e instanceof Error ? e.message : String(e)}`); }
    try { registerUninstaller(); } catch (e) { console.error(`Warning: uninstaller registration failed: ${e instanceof Error ? e.message : String(e)}`); }

    // Set EstimatedSize in registry (KB)
    try {
        const sizeKB = getDirSizeKB(installDir);
        runPowerShell(`Set-ItemProperty -Path "Registry::${regKey}" -Name "EstimatedSize" -Value ${sizeKB} -Type DWord`);
    } catch { /* ignore */ }

    log("\nSetup complete!");

    if (!silent) {
        // Ask to launch
        const launch = await new Promise<string>((resolve) => {
            process.stdout.write("\nLaunch KuumoApp now? [Y/n] ");
            process.stdin.setEncoding("utf8");
            process.stdin.once("data", (data) => resolve(data.toString().trim().toLowerCase()));
            setTimeout(() => resolve("y"), 10_000); // auto-launch after 10s
        });
        if (launch !== "n") {
            const exePath = join(installDir, "KuumoApp.exe");
            if (existsSync(exePath)) {
                spawn(exePath, [], { detached: true, stdio: "ignore" }).unref();
            }
        }
    }
}

main().catch((e) => {
    console.error(`Setup failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
});
