// One-time host-side prep for Windows Sandbox dev runs:
//   1. verifies (and offers to enable) the Windows Sandbox optional feature
//   2. downloads runtime prerequisites into build/sandbox/cache (idempotent)
//   3. generates build/sandbox/kuumo-dev.wsb mapping cache/stage/sync folders
//
// Follow up with `bun run sandbox:run` to build, stage, and launch.
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import readline from "node:readline";

const root = resolve(import.meta.dir, "..");
const sandboxDir = resolve(root, "build", "sandbox");
const cacheDir = resolve(sandboxDir, "cache");
const stageDir = resolve(sandboxDir, "stage");
const syncDir = resolve(sandboxDir, "sync");
const wsbPath = resolve(sandboxDir, "kuumo-dev.wsb");

// Version pins must stay in sync with scripts/install-prereqs.ps1.
// Portable .NET base-runtime zip (not the MSI): the MSI takes ~8 minutes on
// every fresh sandbox, the zip extracts in seconds (provision.ps1 extracts it
// to C:\KuumoDotnet, launch.ts points the app at it via DOTNET_ROOT). Both
// apps' runtimeconfigs only request Microsoft.NETCore.App, which this zip
// ships together with dotnet.exe.
const DOTNET_VERSION = "10.0.9";
const DOTNET_FILE = `dotnet-runtime-${DOTNET_VERSION}-win-x64.zip`;
const DOTNET_URL = `https://dotnetcli.azureedge.net/dotnet/Runtime/${DOTNET_VERSION}/${DOTNET_FILE}`;
const WASDK_FILE = "Microsoft.WindowsAppRuntime.Redist.2.3.zip";
const WASDK_URL = "https://aka.ms/windowsappsdk/2.3/2.3.1/Microsoft.WindowsAppRuntime.Redist.2.3.zip";

const log = (message: string) => console.log(`[sandbox:prepare] ${message}`);
const fail = (message: string): never => {
    console.error(`[sandbox:prepare] ${message}`);
    return process.exit(1);
};

function queryFeatureState(): string | null {
    const result = spawnSync(
        "powershell",
        [
            "-NoProfile",
            "-Command",
            "(Get-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -ErrorAction Stop).State",
        ],
        { encoding: "utf8" },
    );
    if (result.status !== 0) return null;
    return (result.stdout ?? "").trim();
}

function promptYesNo(question: string): Promise<boolean> {
    return new Promise((resolvePrompt) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolvePrompt(/^y(es)?$/i.test(answer.trim()));
        });
    });
}

async function ensureSandboxFeature(): Promise<void> {
    const exe = resolve(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "WindowsSandbox.exe");
    const state = queryFeatureState();
    if (state === null) {
        if (existsSync(exe)) {
            log("could not query feature state (needs elevation); WindowsSandbox.exe exists - assuming available");
            return;
        }
        fail("Windows Sandbox is unavailable (Pro/Enterprise only, feature not installed).");
    }
    if (state === "Enabled") {
        log("Windows Sandbox feature: Enabled");
        return;
    }
    if (state === "EnablePending") {
        fail("Windows Sandbox is pending a reboot - reboot, then re-run sandbox:prepare.");
    }
    if (process.stdin.isTTY !== true) {
        fail(`Windows Sandbox feature: ${state} (non-interactive, cannot prompt to enable it).`);
    }
    log(`Windows Sandbox feature: ${state}`);
    const enable = await promptYesNo("Enable Windows Sandbox now? Requires UAC approval (y/N): ");
    if (!enable) fail("Windows Sandbox is not enabled.");
    log("requesting elevation to enable Windows Sandbox...");
    const enableCmd =
        "Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All -NoRestart | Out-Null";
    const elevated = spawnSync(
        "powershell",
        [
            "-NoProfile",
            "-Command",
            `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','${enableCmd}'`,
        ],
        { stdio: "inherit" },
    );
    if (elevated.status !== 0) fail("failed to run the elevated enable command (UAC declined?).");
    const after = queryFeatureState();
    if (after === "Enabled") {
        log("Windows Sandbox feature: Enabled");
        return;
    }
    if (after === "EnablePending") {
        fail("Windows Sandbox enabled - reboot required, then re-run sandbox:prepare.");
    }
    fail(`Windows Sandbox state after enable attempt: ${after ?? "unknown"}`);
}

async function ensureCached(url: string, destPath: string): Promise<void> {
    if (existsSync(destPath) && statSync(destPath).size > 0) {
        log(`cached: ${basename(destPath)}`);
        return;
    }
    log(`downloading: ${url}`);
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) fail(`download failed (HTTP ${response.status}): ${url}`);
    await Bun.write(destPath, Buffer.from(await response.arrayBuffer()));
    log(`saved: ${basename(destPath)} (${statSync(destPath).size} bytes)`);
}

function escapeXml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function writeWsb(): void {
    // LogonCommand output is hidden, so it opens a visible PowerShell window
    // hosting provision.ps1 instead of running it directly.
    const lines = [
        '<?xml version="1.0" encoding="UTF-16"?>',
        "<Configuration>",
        "  <Networking>Enable</Networking>",
        "  <vGPU>Enable</vGPU>",
        "  <MappedFolders>",
        "    <MappedFolder>",
        `      <HostFolder>${escapeXml(cacheDir)}</HostFolder>`,
        "      <SandboxFolder>C:\\KuumoCache</SandboxFolder>",
        "      <ReadOnly>true</ReadOnly>",
        "    </MappedFolder>",
        "    <MappedFolder>",
        `      <HostFolder>${escapeXml(stageDir)}</HostFolder>`,
        "      <SandboxFolder>C:\\KuumoStage</SandboxFolder>",
        "      <ReadOnly>true</ReadOnly>",
        "    </MappedFolder>",
        "    <MappedFolder>",
        `      <HostFolder>${escapeXml(syncDir)}</HostFolder>`,
        "      <SandboxFolder>C:\\KuumoSync</SandboxFolder>",
        "      <ReadOnly>false</ReadOnly>",
        "    </MappedFolder>",
        "  </MappedFolders>",
        "  <LogonCommand>",
        "    <Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -Command &quot;Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-File','C:\\KuumoStage\\scripts\\provision.ps1'&quot;</Command>",
        "  </LogonCommand>",
        "</Configuration>",
        "",
    ];
    writeFileSync(wsbPath, "\uFEFF" + lines.join("\r\n"), { encoding: "utf16le" });
    log(`wrote: ${wsbPath}`);
}

async function main(): Promise<void> {
    await ensureSandboxFeature();
    mkdirSync(cacheDir, { recursive: true });
    mkdirSync(stageDir, { recursive: true });
    mkdirSync(syncDir, { recursive: true });
    try {
        await ensureCached(DOTNET_URL, resolve(cacheDir, DOTNET_FILE));
        await ensureCached(WASDK_URL, resolve(cacheDir, WASDK_FILE));
    } catch (e) {
        fail(`download failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    writeWsb();
    log("ready - next: bun run sandbox:run");
}

await main();
