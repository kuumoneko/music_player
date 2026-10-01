// Start Menu / AUMID leftovers created by the host dev loop.
//
// winui-dev.ts  creates %APPDATA%\...\Programs\<WINUI_DEV_SHORTCUT>.lnk (AUMID kuumo.app.dev)
//               via scripts/CheckShortcut, so the script also removes it.
// Avalonia creates its own <AVALONIA_DEV_SHORTCUT>.lnk plus the
//               HKCU\Software\Classes\AppUserModelId\<AVALONIA_DEV_AUMID> key at app start
//               (Program.RegisterAumidInRegistry / StartMenuHelper.EnsureShortcut).
//
// Every removal here is *guarded*: it only ever deletes a shortcut whose target resolves
// inside this repo, and only a registry key whose DisplayName/IconUri prove it is ours.
// That keeps a name collision with an installed build (e.g. F:\KuumoApp) from losing the
// production Start Menu entry.

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const REPO_ROOT = resolve(import.meta.dir, "..");

export const WINUI_DEV_SHORTCUT = "KuumoApp WinUI Test";
export const AVALONIA_DEV_SHORTCUT = "KuumoApp Avalonia Test";
export const AVALONIA_DEV_AUMID = "KuumoAvalonia.dev";

// Legacy DisplayName (an older build used it) is still cleaned up.
const AVALONIA_DEV_DISPLAY_NAMES = [AVALONIA_DEV_SHORTCUT, "Kuumo Avalonia Test"];

export function startMenuProgramsDir(): string {
    return resolve(
        process.env["APPDATA"] ?? "",
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
    );
}

function runPowerShell(command: string): { status: number; stdout: string } {
    const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
        encoding: "utf8",
        windowsHide: true,
    });
    return {
        status: result.status ?? 1,
        stdout: String(result.stdout ?? ""),
    };
}

function quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function isUnderRepoRoot(target: string): boolean {
    const normalized = target.toLowerCase().replace(/\//g, "\\");
    const root = REPO_ROOT.toLowerCase().replace(/\//g, "\\");
    return normalized === root || normalized.startsWith(`${root}\\`);
}

/** Reads the shortcut's target via WScript.Shell, or null if unreadable. */
function readShortcutTarget(lnkPath: string): string | null {
    if (!existsSync(lnkPath)) return null;
    // Statements must be newline- (or ';'-) separated; a plain space makes PowerShell
    // fail with "Unexpected token 'if'", which would silently turn every removal into a skip.
    const command = [
        `try {`,
        `  $s = (New-Object -ComObject WScript.Shell).CreateShortcut(${quote(lnkPath)})`,
        `  if ($s.TargetPath) { [Console]::Out.Write($s.TargetPath) }`,
        `} catch { }`,
    ].join("\r\n");
    const { stdout } = runPowerShell(command);
    const target = stdout.trim();
    return target.length > 0 ? target : null;
}

/**
 * Deletes a Start Menu shortcut only when it exists and points inside this repo.
 * Returns true when the file was removed.
 */
export function removeRepoShortcut(shortcutName: string): boolean {
    const lnkPath = resolve(startMenuProgramsDir(), `${shortcutName}.lnk`);
    if (!existsSync(lnkPath)) return false;

    const target = readShortcutTarget(lnkPath);
    if (target === null) {
        console.error(`[dev-artifacts] cannot read target of ${shortcutName}.lnk - leaving it alone`);
        return false;
    }
    if (!isUnderRepoRoot(target)) {
        console.error(
            `[dev-artifacts] refusing to delete ${shortcutName}.lnk - target "${target}" is outside ${REPO_ROOT}`,
        );
        return false;
    }
    rmSync(lnkPath, { force: true });
    return true;
}

interface AumidKeyValues {
    displayName: string;
    iconUri: string;
}

function readAumidKey(keyPath: string): AumidKeyValues | null {
    const command = [
        `if (-not (Test-Path -LiteralPath ${quote(keyPath)})) { exit 0 }`,
        `$p = Get-ItemProperty -LiteralPath ${quote(keyPath)} -ErrorAction SilentlyContinue`,
        `if ($null -eq $p) { exit 0 }`,
        `[Console]::Out.Write([string]$p.DisplayName)`,
        `[Console]::Out.Write([char]1)`,
        `[Console]::Out.Write([string]$p.IconUri)`,
    ].join("; ");
    const { status, stdout } = runPowerShell(command);
    if (status !== 0 || stdout.length === 0) return null;
    const parts = stdout.split("\u0001");
    return {
        displayName: (parts[0] ?? "").trim(),
        iconUri: (parts[1] ?? "").trim(),
    };
}

/**
 * Deletes a dev-only AppUserModelId registry key only when its DisplayName is one of ours
 * or its IconUri resolves inside this repo. Returns true when the key was removed.
 */
export function removeDevAumidKey(keyPath: string): boolean {
    const values = readAumidKey(keyPath);
    if (values === null) return false;

    const oursByName = AVALONIA_DEV_DISPLAY_NAMES.some(
        (name) => values.displayName.toLowerCase() === name.toLowerCase(),
    );
    const oursByIcon = values.iconUri.length > 0 && isUnderRepoRoot(values.iconUri);
    if (!oursByName && !oursByIcon) {
        console.error(
            `[dev-artifacts] refusing to delete ${keyPath} - DisplayName="${values.displayName}" IconUri="${values.iconUri}"`,
        );
        return false;
    }
    runPowerShell(`Remove-Item -LiteralPath ${quote(keyPath)} -Recurse -ErrorAction SilentlyContinue`);
    return !existsSyncRegistryKey(keyPath);
}

function existsSyncRegistryKey(keyPath: string): boolean {
    const { stdout } = runPowerShell(
        `if (Test-Path -LiteralPath ${quote(keyPath)}) { [Console]::Out.Write("1") }`,
    );
    return stdout.includes("1");
}

/** Removes the WinUI dev artifacts (shortcut created by winui-dev.ts). */
export function removeWinuiDevArtifacts(): void {
    removeRepoShortcut(WINUI_DEV_SHORTCUT);
}

/** Removes the Avalonia dev artifacts (shortcut + AUMID key created by the app itself). */
export function removeAvaloniaDevArtifacts(): void {
    removeRepoShortcut(AVALONIA_DEV_SHORTCUT);
    removeDevAumidKey(`HKCU:\\SOFTWARE\\Classes\\AppUserModelId\\${AVALONIA_DEV_AUMID}`);
}
