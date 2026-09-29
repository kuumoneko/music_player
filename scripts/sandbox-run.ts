// Builds dev artifacts on the host, stages them (plus the sandbox scripts)
// into build/sandbox/stage, and either opens the Windows Sandbox (boot mode)
// or hands the build to an already-open sandbox (sync mode).
//
// Usage:
//   bun run sandbox:run                     boot a sandbox (syncs instead if one is open)
//   bun run sandbox:run --target winui
//   bun run sandbox:run --target avalonia --launch avalonia
//   bun run sandbox:run --skip-build        (reuse previous build outputs)
//   bun run sandbox:run --no-seed-db        (don't snapshot the host app_data.sqlite)
//   bun run sandbox:run --smoke             (ask the guest to run the RPC smoke test)
//   bun run sandbox:run --fresh             (open a new sandbox even if one is running)
//   bun run sandbox:run --force-tools       (rebuild staged tooling such as CheckShortcut)
//   bun run sandbox:sync                    restage only (requires an open sandbox)
//
// Modes:
//   boot - no sandbox window open: full stage, then launch a fresh VM. The guest
//          (provision.ps1) copies the stage once and starts launch.ts.
//   sync - a sandbox window is already open: rebuild + incremental restage only.
//          stage\manifest.json gets a fresh nonce; the guest's launch.ts polls it,
//          re-copies the payload in place and relaunches the app - no VM restart,
//          no runtime provisioning, no re-seeding of the guest database.
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";

const root = resolve(import.meta.dir, "..");
const sandboxDir = resolve(root, "build", "sandbox");
const stageDir = resolve(sandboxDir, "stage");
const syncDir = resolve(sandboxDir, "sync");
const wsbPath = resolve(sandboxDir, "kuumo-dev.wsb");
const PROFILE = "myown";

const log = (message: string) => console.log(`[sandbox:run] ${message}`);
const fail = (message: string): never => {
    console.error(`[sandbox:run] ${message}`);
    return process.exit(1);
};

const cliArgs = process.argv.slice(2);
function argValue(flag: string): string | undefined {
    const index = cliArgs.indexOf(flag);
    return index !== -1 ? cliArgs[index + 1] : undefined;
}

const explicitTarget = argValue("--target");
const explicitLaunch = argValue("--launch");
let target = explicitTarget ?? "both";
if (target !== "winui" && target !== "avalonia" && target !== "both") {
    fail(`invalid --target: ${target} (expected winui|avalonia|both)`);
}
let launch = explicitLaunch ?? (target === "avalonia" ? "avalonia" : "winui");
if (launch !== "winui" && launch !== "avalonia") {
    fail(`invalid --launch: ${launch} (expected winui|avalonia)`);
}
if (launch === "avalonia" && target === "winui") fail("--launch avalonia requires --target avalonia|both");
if (launch === "winui" && target === "avalonia") fail("--launch winui requires --target winui|both");
const skipBuild = cliArgs.includes("--skip-build");
const forceFresh = cliArgs.includes("--fresh");
const forceTools = cliArgs.includes("--force-tools");
const syncOnly = cliArgs.includes("--sync");
const smokeRequested = cliArgs.includes("--smoke");

const WINUI_CSPROJ = "app-winui/KuumoApp/KuumoApp.csproj";
const AVALONIA_CSPROJ = "app-avalonia/KuumoApp/KuumoApp.csproj";
const winuiOut = resolve(root, "app-winui", "KuumoApp", "bin", "x64", "Debug", "net10.0-windows10.0.22621.0", "win-x64");
const avaloniaOut = resolve(root, "app-avalonia", "KuumoApp", "bin", "Debug", "net10.0-windows10.0.22621.0", "win-x64");

function run(cmd: string, args: string[]): void {
    log(`> ${cmd} ${args.join(" ")}`);
    const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: false });
    if (result.status !== 0) fail(`${cmd} failed (exit ${result.status})`);
}

// A closed-but-lingering sandbox VM keeps handles on the mapped host folders,
// which makes rmSync fail with EBUSY. Active sessions are left alone (ask the
// user to close the window); orphaned VM workers get an elevated cleanup.
function removeAll(path: string): void {
    try {
        rmSync(path, { recursive: true, force: true });
        return;
    } catch (e) {
        const code = (e as { code?: unknown }).code;
        if (code !== "EBUSY" && code !== "EPERM") throw e;
    }
    const session = spawnSync(
        "powershell",
        ["-NoProfile", "-Command", "(Get-Process -Name WindowsSandboxServer,WindowsSandboxRemoteSession -ErrorAction SilentlyContinue | Measure-Object).Count"],
        { encoding: "utf8" },
    );
    if (parseInt((session.stdout ?? "0").trim(), 10) > 0) {
        fail(`${path} is locked by a running Windows Sandbox session - close the sandbox window, then re-run.`);
    }
    log(`${path} is locked by a lingering sandbox VM - requesting elevated cleanup (accept the UAC prompt)...`);
    const kill = "Stop-Process -Name vmwp,WindowsSandboxServer,WindowsSandboxRemoteSession,WindowsSandbox -Force -ErrorAction SilentlyContinue";
    const elevated = spawnSync(
        "powershell",
        ["-NoProfile", "-Command", `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command','${kill}'`],
        { stdio: "inherit" },
    );
    if (elevated.status !== 0) fail(`could not clean up lingering sandbox processes (UAC declined?) - remove ${path} manually.`);
    rmSync(path, { recursive: true, force: true });
}

function buildFrontend(csproj: string, extraArgs: string[]): void {
    const assets = resolve(root, csproj, "..", "obj", "project.assets.json");
    if (!existsSync(assets)) {
        log(`no NuGet restore found for ${csproj} - restoring...`);
        run("dotnet", ["restore", csproj]);
    }
    run("dotnet", ["build", "--no-restore", "-m", csproj, ...extraArgs]);
}

// Incremental file copy: skips the copy when the destination already has the
// same size and mtime (preserved on copy), so a restage only touches what the
// build actually changed. After removeAll() in boot mode the destination never
// exists, so the first stage copies everything.
function copyFileIncremental(src: string, dest: string): boolean {
    const source = statSync(src);
    try {
        const target = statSync(dest);
        if (target.isFile() && target.size === source.size && Math.abs(target.mtimeMs - source.mtimeMs) < 1) {
            return false;
        }
    } catch {
        // destination missing - fall through to the copy
    }
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { preserveTimestamps: true });
    return true;
}

// Mirrors src into dest: incremental file copies plus deletion of entries that
// no longer exist in the source (boot mode starts from an empty stage, so the
// prune is a no-op there).
function syncTree(src: string, dest: string): { copied: number; removed: number } {
    let copied = 0;
    let removed = 0;
    mkdirSync(dest, { recursive: true });
    const keep = new Set<string>();
    for (const entry of readdirSync(src, { withFileTypes: true })) {
        keep.add(entry.name);
        const from = resolve(src, entry.name);
        const to = resolve(dest, entry.name);
        if (entry.isDirectory()) {
            const result = syncTree(from, to);
            copied += result.copied;
            removed += result.removed;
        } else if (copyFileIncremental(from, to)) {
            copied++;
        }
    }
    for (const entry of readdirSync(dest, { withFileTypes: true })) {
        if (!keep.has(entry.name)) {
            rmSync(resolve(dest, entry.name), { recursive: true, force: true });
            removed++;
        }
    }
    return { copied, removed };
}

function stageBackend(): void {
    const backendStage = resolve(stageDir, "backend");
    mkdirSync(backendStage, { recursive: true });
    const keep = new Set<string>(["backend.js"]);
    copyFileIncremental(resolve(root, "build", "backend.js"), resolve(backendStage, "backend.js"));
    // build\bin\ mirror (the bundled native DLLs)...
    const buildBin = resolve(root, "build", "bin");
    if (existsSync(buildBin)) {
        keep.add("bin");
        syncTree(buildBin, resolve(backendStage, "bin"));
    }
    // ...and the native DLLs at the backend dir root: the backend dlopens
    // libmpv/ffmpeg from its CWD (BunHostService sets that to the backend
    // dir), while build.ts only copies them into build\bin\.
    const binDir = resolve(root, "bin");
    for (const entry of readdirSync(binDir)) {
        const source = resolve(binDir, entry);
        if (statSync(source).isFile()) {
            copyFileIncremental(source, resolve(backendStage, entry));
            keep.add(entry);
        }
    }
    for (const entry of readdirSync(backendStage)) {
        if (!keep.has(entry)) rmSync(resolve(backendStage, entry), { recursive: true, force: true });
    }
    log("staged: backend");
}

function stageApp(outDir: string, stageName: string, bunExe: string): void {
    const result = syncTree(outDir, resolve(stageDir, stageName));
    // BunHostService resolves bun.exe next to the app exe before falling back
    // to PATH, so drop a copy beside KuumoApp.exe.
    copyFileIncremental(bunExe, resolve(stageDir, stageName, "bun.exe"));
    log(`staged: ${stageName} (${result.copied} copied, ${result.removed} removed)`);
}

// Snapshot the host's dev database into the stage so the guest app boots with
// real data (playlists, settings, caches, log history). VACUUM INTO reads the
// WAL-consistent state through a readonly connection — safe even while the
// host backend is running, and it never writes to the source. Skipped when the
// source is unchanged since the last snapshot (tracked via .seed-meta.json).
function stageSeedDb(): void {
    if (cliArgs.includes("--no-seed-db")) {
        log("skipping DB seed (--no-seed-db)");
        return;
    }
    const sources = [
        resolve(process.env["APPDATA"] ?? "", "KuumoApp", "app_data.sqlite"),
        resolve(root, "data", "dev", "app_data.sqlite"),
    ];
    const source = sources.find((p) => existsSync(p));
    if (!source) {
        log("no host app_data.sqlite found - guest will start with an empty database");
        return;
    }
    const dest = resolve(stageDir, "data", "app_data.sqlite");
    const metaPath = resolve(stageDir, "data", ".seed-meta.json");
    const sourceStat = statSync(source);
    const meta = JSON.stringify({ source, size: sourceStat.size, mtimeMs: sourceStat.mtimeMs });
    try {
        if (existsSync(dest) && readFileSync(metaPath, "utf8") === meta) {
            log("staged: data/app_data.sqlite (unchanged)");
            return;
        }
    } catch {
        // no marker yet - take a fresh snapshot
    }
    try {
        const db = new Database(source, { readonly: true });
        try {
            // VACUUM INTO refuses to overwrite an existing destination.
            rmSync(dest, { force: true });
            db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
        } finally {
            db.close();
        }
        writeFileSync(metaPath, meta);
        log(`staged: data/app_data.sqlite (seeded from ${source})`);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        fail(`failed to snapshot host database: ${message}`);
    }
}

function stageCheckShortcut(): void {
    const checkShortcutProj = resolve(root, "scripts", "CheckShortcut", "CheckShortcut.csproj");
    if (!existsSync(checkShortcutProj)) fail(`CheckShortcut project not found: ${checkShortcutProj}`);
    const checkShortcutOut = resolve(root, "scripts", "CheckShortcut", "bin", "Debug", "net10.0");
    if (forceTools || !existsSync(resolve(checkShortcutOut, "CheckShortcut.dll"))) {
        run("dotnet", ["build", "-v", "q", checkShortcutProj]);
    } else {
        log("CheckShortcut build output exists - skipping (--force-tools to rebuild)");
    }
    if (!existsSync(resolve(checkShortcutOut, "CheckShortcut.dll"))) {
        fail(`CheckShortcut build output not found: ${checkShortcutOut}`);
    }
    syncTree(checkShortcutOut, resolve(stageDir, "scripts", "CheckShortcut"));
    log("staged: scripts/CheckShortcut");
}

interface StagedSession {
    target: string;
    launch: string;
}

function readStagedSession(): StagedSession | null {
    try {
        const parsed = JSON.parse(readFileSync(resolve(stageDir, "sandbox.json"), "utf8")) as Partial<StagedSession>;
        if (
            (parsed.target === "winui" || parsed.target === "avalonia" || parsed.target === "both") &&
            (parsed.launch === "winui" || parsed.launch === "avalonia")
        ) {
            return { target: parsed.target, launch: parsed.launch };
        }
    } catch {
        // missing or corrupt - caller decides what that means
    }
    return null;
}

function sandboxWindowCount(): number {
    const result = spawnSync(
        "powershell",
        ["-NoProfile", "-Command", "(Get-Process -Name WindowsSandbox -ErrorAction SilentlyContinue | Measure-Object).Count"],
        { encoding: "utf8" },
    );
    const count = parseInt((result.stdout ?? "0").trim(), 10);
    return Number.isNaN(count) ? 0 : count;
}

// The guest writes this every couple of seconds from launch.ts, so a stale or
// missing heartbeat means nobody is listening for the manifest nonce.
const HEARTBEAT_MAX_AGE_MS = 30_000;

function requireLiveGuest(): void {
    let at: string | undefined;
    try {
        at = (JSON.parse(readFileSync(resolve(syncDir, "heartbeat.json"), "utf8")) as { at?: string }).at;
    } catch {
        at = undefined;
    }
    const ageMs = at ? Date.now() - Date.parse(at) : Number.NaN;
    if (!at) {
        fail("no guest heartbeat found - the sandbox is still starting (provisioning runs at logon); wait a moment and re-run");
    } else if (!Number.isFinite(ageMs)) {
        fail(`guest heartbeat has an unreadable timestamp: ${at}`);
    } else if (ageMs > HEARTBEAT_MAX_AGE_MS) {
        fail(`guest heartbeat is ${Math.round(ageMs / 1000)}s old - the sandbox looks dead or its window is lingering; close it and re-run (or: bun run sandbox:run --fresh)`);
    }
}

async function main(): Promise<void> {
    const openWindows = sandboxWindowCount();

    let mode: "boot" | "sync";
    if (syncOnly) {
        if (openWindows === 0) {
            fail("--sync needs an open sandbox window - run first: bun run sandbox:run");
        }
        mode = "sync";
    } else if (openWindows > 0 && !forceFresh) {
        mode = "sync";
        log(`sandbox window already open - restaging into it instead of starting another (use --fresh to override)`);
    } else {
        mode = "boot";
    }

    if (mode === "sync") {
        requireLiveGuest();
        const session = readStagedSession();
        if (!session) {
            fail(`no staged session at ${resolve(stageDir, "sandbox.json")} - run once with no sandbox open: bun run sandbox:run`);
        } else {
            if (explicitTarget && explicitTarget !== session.target) {
                fail(`session runs target=${session.target}; switching to --target ${explicitTarget} needs a new session: bun run sandbox:run --fresh`);
            }
            if (explicitLaunch && explicitLaunch !== session.launch) {
                fail(`session launches ${session.launch}; switching to --launch ${explicitLaunch} needs a new session: bun run sandbox:run --fresh`);
            }
            target = session.target;
            launch = session.launch;
            log(`session: target=${target} launch=${launch}`);
        }
    }

    if (!skipBuild) {
        log("rebuilding backend bundle...");
        run("bun", ["run", "--silent", "build:prod", "--", "--dev"]);
        if (target === "winui" || target === "both") {
            log("building WinUI app...");
            buildFrontend(WINUI_CSPROJ, ["-p:Platform=x64", "-p:WindowsAppSDKSelfContained=false"]);
        }
        if (target === "avalonia" || target === "both") {
            log("building Avalonia app...");
            buildFrontend(AVALONIA_CSPROJ, []);
        }
    } else {
        log("skipping builds (--skip-build)");
    }

    const profileFile = resolve(root, "apikeys", `${PROFILE}.json`);
    if (!existsSync(profileFile)) fail(`Missing profile file: ${profileFile}`);
    log("baking credentials into data/system.json...");
    run("bun", ["./scripts/encrypt-credentials.ts", "--profile", PROFILE]);

    const winuiExe = resolve(winuiOut, "KuumoApp.exe");
    const avaloniaExe = resolve(avaloniaOut, "KuumoApp.exe");
    if ((target === "winui" || target === "both") && !existsSync(winuiExe)) {
        fail(`WinUI exe not found: ${winuiExe}`);
    }
    if ((target === "avalonia" || target === "both") && !existsSync(avaloniaExe)) {
        fail(`Avalonia exe not found: ${avaloniaExe}`);
    }
    const systemFile = resolve(root, "data", "system.json");
    if (!existsSync(systemFile)) fail(`data/system.json not found: ${systemFile}`);
    const bunExe = process.execPath;
    if (!existsSync(bunExe)) fail(`bun executable not found: ${bunExe}`);

    if (mode === "boot") {
        log("staging payload...");
        removeAll(stageDir);
        mkdirSync(stageDir, { recursive: true });
    } else {
        log("re-staging payload (incremental)...");
    }

    stageBackend();
    if (target === "winui" || target === "both") stageApp(winuiOut, "app-winui", bunExe);
    if (target === "avalonia" || target === "both") stageApp(avaloniaOut, "app-avalonia", bunExe);
    // provision.ps1 launches launch.ts via stage\bun\bun.exe (separate from
    // the copies beside each KuumoApp.exe that BunHostService resolves).
    mkdirSync(resolve(stageDir, "bun"), { recursive: true });
    copyFileIncremental(bunExe, resolve(stageDir, "bun", "bun.exe"));
    log("staged: bun");

    mkdirSync(resolve(stageDir, "data"), { recursive: true });
    copyFileIncremental(systemFile, resolve(stageDir, "data", "system.json"));
    stageSeedDb();
    // Start Menu shortcut writer used by launch.ts to register the process
    // AUMID inside the guest (SMTC attribution). Built on first use so it is a
    // staging prerequisite like the credential bake above.
    stageCheckShortcut();

    mkdirSync(resolve(stageDir, "scripts"), { recursive: true });
    for (const script of ["provision.ps1", "launch.ts", "sync.ps1"]) {
        const source = resolve(root, "scripts", "sandbox", script);
        if (!existsSync(source)) fail(`sandbox script not found: ${source}`);
        copyFileIncremental(source, resolve(stageDir, "scripts", script));
    }
    // RPC smoke test run inside the guest by launch.ts (needs no apikeys when
    // given --ws-url, so it never touches the profile).
    const testRpc = resolve(root, "scripts", "test-rpc.ts");
    if (!existsSync(testRpc)) fail(`RPC test suite not found: ${testRpc}`);
    copyFileIncremental(testRpc, resolve(stageDir, "scripts", "test-rpc.ts"));
    writeFileSync(resolve(stageDir, "sandbox.json"), JSON.stringify({ target, launch }, null, 2) + "\n");
    // Written last: the guest's launch.ts polls this nonce to decide when the
    // host has finished restaging, so it must never appear mid-copy.
    const manifest = {
        nonce: randomUUID(),
        at: new Date().toISOString(),
        target,
        launch,
        ...(smokeRequested ? { smoke: true } : {}),
    };
    writeFileSync(resolve(stageDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    log(`staged: data, scripts, sandbox.json, manifest (target=${target}, launch=${launch})`);

    if (mode === "sync") {
        log(`manifest ${manifest.nonce.slice(0, 8)} published - guest picks it up within ~1s`);
        log(`status handoff: ${resolve(syncDir, "status.json")}`);
        process.exit(0);
    }

    // Fresh status handoff dir so host-side checks never read stale results.
    removeAll(syncDir);
    mkdirSync(syncDir, { recursive: true });

    if (!existsSync(wsbPath)) fail(`missing ${wsbPath} - run: bun run sandbox:prepare`);
    const sandboxExe = resolve(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "WindowsSandbox.exe");
    if (!existsSync(sandboxExe)) fail("WindowsSandbox.exe not found - run: bun run sandbox:prepare");

    if (openWindows > 0) {
        log("note: --fresh with an existing sandbox window - this launches a second one.");
    }

    log(`launching sandbox (target=${target}, launch=${launch})...`);
    Bun.spawn([sandboxExe, wsbPath], {
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
    });
    log("sandbox window should open shortly; provisioning runs at logon (installs cached runtimes, then starts the app).");
    log(`status handoff: ${resolve(syncDir, "status.json")}`);
    process.exit(0);
}

await main();
