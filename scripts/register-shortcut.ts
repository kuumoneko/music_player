import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const outDir = resolve(root, "app-winui", "KuumoApp", "bin", "x64", "Debug", "net10.0-windows10.0.22621.0", "win-x64");
const exe = resolve(outDir, "KuumoApp.exe");
const icon = resolve(outDir, "Assets", "AppIcon.ico");

if (!existsSync(exe)) {
    console.error(`Missing exe: ${exe}`);
    process.exit(1);
}

const startMenu = resolve(process.env["APPDATA"] ?? "", "Microsoft", "Windows", "Start Menu", "Programs");
const oldPath = resolve(startMenu, "KuumoApp.lnk");
const newPath = resolve(startMenu, "Kuumo App.lnk");

const ps = [
    `$sh = New-Object -ComObject WScript.Shell`,
    `$lnk = $sh.CreateShortcut(${JSON.stringify(oldPath)})`,
    `$lnk.TargetPath = ${JSON.stringify(exe)}`,
    `$lnk.IconLocation = ${JSON.stringify(icon + ",0")}`,
    `$lnk.Save()`,
    `if (Test-Path ${JSON.stringify(oldPath)}) { Move-Item -Force ${JSON.stringify(oldPath)} ${JSON.stringify(newPath)} }`,
    `Write-Output "shortcut updated: ${JSON.stringify(newPath)}"`,
].join("; ");

const result = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
