// In-sandbox dev launcher — runs inside Windows Sandbox (payload at
// C:\KuumoDev), invoked by scripts/sandbox/provision.ps1. Starts the staged
// KuumoApp.exe with dev env vars, then watches the backend log for the
// WebSocket endpoint and app health from the backend log table.
// Writes status to C:\KuumoSync\status.json for the host to inspect.
//
// Commands: q = stop app/backend and exit, r = relaunch app,
//           s = run the RPC smoke test (opt-in).
import { basename, resolve } from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Database } from "bun:sqlite";
import readline from "node:readline";

const payloadRoot = resolve(import.meta.dir, "..");
const dataDir = resolve(process.env["APPDATA"] ?? "", "KuumoApp");
const logDbPath = resolve(dataDir, "app_data.sqlite");
// Read-write mapped folder (build\sandbox\sync on the host).
const syncStatusPath = "C:\\KuumoSync\\status.json";

interface SandboxMeta {
    target: string;
    launch: string;
}

function readMeta(): SandboxMeta {
    const metaPath = resolve(payloadRoot, "sandbox.json");
    if (existsSync(metaPath)) {
        try {
            const parsed = JSON.parse(readFileSync(metaPath, "utf8")) as Partial<SandboxMeta>;
            if (parsed.launch === "winui" || parsed.launch === "avalonia") {
                return { target: parsed.target ?? "both", launch: parsed.launch };
            }
        } catch {
            // fall through to defaults
        }
    }
    return { target: "both", launch: "winui" };
}

const meta = readMeta();
const appDir = resolve(payloadRoot, meta.launch === "avalonia" ? "app-avalonia" : "app-winui");
const appExe = resolve(appDir, "KuumoApp.exe");

// Host-staged manifest: sandbox-run.ts writes a fresh nonce whenever it has
// finished restaging (boot or sync). Polling it lets the guest pick up new
// builds in place - no VM restart, no runtime provisioning, no DB re-seed.
const stageRoot = "C:\\KuumoStage";
const stageManifestPath = resolve(stageRoot, "manifest.json");
const payloadManifestPath = resolve(payloadRoot, "manifest.json");
const heartbeatPath = "C:\\KuumoSync\\heartbeat.json";

interface StageManifest {
    nonce?: string;
    smoke?: boolean;
}

function readManifest(path: string): StageManifest | null {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as StageManifest;
    } catch {
        return null;
    }
}

function manifestNonce(path: string): string | null {
    const nonce = readManifest(path)?.nonce;
    return typeof nonce === "string" ? nonce : null;
}

// provision.ps1 copied the stage before this process started, so the payload
// manifest already matches the stage one; a later host restage breaks the tie.
let syncedNonce: string | null = manifestNonce(payloadManifestPath);

// The host's sandbox:sync refuses to restage against a guest that is not
// listening, so keep this fresh even while long steps (endpoint wait, payload
// copy, smoke test) are in flight - it runs off a timer, not the watch loop.
function writeHeartbeat(): void {
    try {
        writeFileSync(heartbeatPath, JSON.stringify({ at: new Date().toISOString(), nonce: syncedNonce }) + "\n");
    } catch {
        // sync folder only exists inside the sandbox
    }
}

writeHeartbeat();
setInterval(writeHeartbeat, 2000);

// Set again after the initial cycle (below); declared here so handleStageUpdate
// can safely assign it no matter when it runs.
let watching = false;

function getMaxLogId(): number {
    if (!existsSync(logDbPath)) return 0;
    try {
        const db = new Database(logDbPath);
        try {
            const row = db.query<{ m: number }, []>("SELECT COALESCE(MAX(id), 0) AS m FROM log").get();
            return row?.m ?? 0;
        } finally {
            db.close();
        }
    } catch {
        return 0;
    }
}

function readFreshLogs(sinceId: number): { id: number; message: string }[] {
    if (!existsSync(logDbPath)) return [];
    try {
        const db = new Database(logDbPath);
        try {
            return db.query<{ id: number; message: string }, [number]>(
                "SELECT id, message FROM log WHERE id > ? ORDER BY id",
            ).all(sinceId);
        } finally {
            db.close();
        }
    } catch {
        return [];
    }
}

const KILL_SCRIPT = [
    "Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | Stop-Process -Force",
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^bun' -and $_.CommandLine -match 'backend\\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    "exit 0",
].join("; ");

function killAll() {
    spawnSync("powershell", ["-NoProfile", "-Command", KILL_SCRIPT], { stdio: "ignore" });
}

function appIsRunning(): boolean {
    const check = spawnSync("powershell", [
        "-NoProfile",
        "-Command",
        "Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id",
    ]);
    return (check.stdout?.toString().trim().length ?? 0) > 0;
}

function buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) env[key] = value;
    }
    // Portable .NET runtime extracted by provision.ps1 (no registered
    // machine-wide install exists in the sandbox).
    const portableDotnet = "C:\\KuumoDotnet";
    if (existsSync(resolve(portableDotnet, "dotnet.exe"))) {
        env["DOTNET_ROOT"] = portableDotnet;
        env["PATH"] = `${portableDotnet};${env["PATH"] ?? ""}`;
    }
    env["KUUMO_DEV"] = "1";
    env["KUUMO_BACKEND_DIR"] = resolve(payloadRoot, "backend");
    env["KUUMO_ASSETS_DIR"] = payloadRoot;
    return env;
}

let spawnExit: number | null = null;
let spawnGeneration = 0;

function spawnApp(): void {
    spawnExit = null;
    const generation = ++spawnGeneration;
    const proc = Bun.spawn([appExe], {
        cwd: payloadRoot,
        env: buildEnv(),
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
    });
    void proc.exited.then((code) => {
        if (generation === spawnGeneration) spawnExit = code ?? -1;
    });
}

interface CycleResult {
    endpoint: string | null;
    problems: string[];
    alive: boolean;
    spawnExit: number | null;
}

interface SmokeFailure {
    test: string;
    error: string;
}

interface SmokeResult {
    passed: number;
    failed: number;
    skipped: number;
    failures: SmokeFailure[];
}

interface StatusFile extends CycleResult {
    at: string;
    target: string;
    launch: string;
    stageNonce?: string;
    smoke?: SmokeResult;
    stoppedAt?: string;
    stopReason?: string;
}

// Last healthy cycle - teardown preserves it (plus a stop marker) instead of
// clobbering the evidence with endpoint: null, so the host can still audit
// the run after the window closes.
let lastResult: CycleResult | null = null;
let smokeResult: SmokeResult | null = null;

function writeStatus(
    result: CycleResult,
    extra?: { smoke?: SmokeResult | null; stoppedAt?: string; stopReason?: string; stageNonce?: string },
): void {
    const status: StatusFile = {
        at: new Date().toISOString(),
        target: meta.target,
        launch: meta.launch,
        endpoint: result.endpoint,
        alive: result.alive,
        spawnExit: result.spawnExit,
        problems: result.problems,
    };
    const smoke = extra?.smoke ?? smokeResult;
    if (smoke) status.smoke = smoke;
    if (extra?.stageNonce) status.stageNonce = extra.stageNonce;
    if (extra?.stoppedAt) status.stoppedAt = extra.stoppedAt;
    if (extra?.stopReason) status.stopReason = extra.stopReason;
    try {
        writeFileSync(syncStatusPath, JSON.stringify(status, null, 2) + "\n");
    } catch {
        // sync folder only exists inside the sandbox
    }
}

// The app writes crash.log into its own base dir; the backend logs into the
// sqlite log table. Both live only inside the VM, so copy them to the sync
// folder for the host to inspect. Runs at every cycle end (also on success)
// so the host can audit the backend log after a healthy run. VACUUM INTO
// snapshots the WAL-consistent state through a readonly connection while the
// backend may still be writing; a raw file copy could capture a torn state.
function copyDiagnostics(): void {
    const syncDir = "C:\\KuumoSync";
    const crashLog = resolve(appDir, "crash.log");
    if (existsSync(crashLog)) {
        try {
            copyFileSync(crashLog, resolve(syncDir, basename(crashLog)));
        } catch {
            // best effort
        }
    }
    if (!existsSync(logDbPath)) return;
    const dest = resolve(syncDir, "app_data.sqlite");
    try {
        rmSync(dest, { force: true });
        const db = new Database(logDbPath, { readonly: true });
        try {
            db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
        } finally {
            db.close();
        }
    } catch {
        try {
            copyFileSync(logDbPath, dest);
        } catch {
            // best effort
        }
    }
}

// One-way copy of the host-seeded database (staged by sandbox-run.ts) into
// the guest data dir, so the app boots with the machine's real playlists,
// settings and caches. Done once before the first spawn: retry/relaunch must
// not wipe state accumulated during the session. Stale WAL sidecars from a
// previous copy would corrupt the fresh main file, so remove them too.
function seedGuestDb(): void {
    const staged = resolve(payloadRoot, "data", "app_data.sqlite");
    if (!existsSync(staged)) {
        console.log("[sandbox:launch] no seeded app_data.sqlite - starting with an empty database");
        return;
    }
    try {
        mkdirSync(dataDir, { recursive: true });
        for (const sidecar of ["app_data.sqlite-wal", "app_data.sqlite-shm"]) {
            rmSync(resolve(dataDir, sidecar), { force: true });
        }
        copyFileSync(staged, resolve(dataDir, "app_data.sqlite"));
        console.log("[sandbox:launch] seeded guest app_data.sqlite from staged host snapshot");
    } catch (e) {
        console.log(`[sandbox:launch] WARNING: could not seed app_data.sqlite: ${e instanceof Error ? e.message : String(e)}`);
    }
}

// The Now Playing/SMTC overlay resolves the app name and logo from the Start
// Menu shortcut whose System.AppUserModel.ID matches the process AUMID set by
// the app (App.xaml.cs / Avalonia Program.cs). On the host only the installer
// creates that shortcut; the sandbox has neither, so create it here — before
// the first spawn, since the shell resolves window identity at creation time.
// The shortcut is named "KuumoApp": the guest has no installed app, and the
// name must not collide with an installer-created shortcut (AUMID kuumo.app).
function shortcutIdentity(): { name: string; aumid: string } {
    // Both targets register the Start Menu entry as "KuumoApp"; only the
    // AUMID differs (must match the process AUMID each app sets).
    return {
        name: "KuumoApp",
        aumid: meta.launch === "avalonia" ? "KuumoAvalonia.dev" : "kuumo.app.dev",
    };
}

function ensureStartMenuShortcut(): void {
    const { name: shortcutName, aumid } = shortcutIdentity();
    const dotnetExe = resolve("C:\\KuumoDotnet", "dotnet.exe");
    const toolDll = resolve(payloadRoot, "scripts", "CheckShortcut", "CheckShortcut.dll");
    const iconPath = resolve(appDir, "Assets", "AppIcon.ico");
    const shortcutDir = resolve(
        process.env["APPDATA"] ?? "",
        "Microsoft", "Windows", "Start Menu", "Programs",
    );
    const shortcutPath = resolve(shortcutDir, `${shortcutName}.lnk`);

    if (!existsSync(dotnetExe)) {
        console.log(`[sandbox:launch] WARNING: portable dotnet not found: ${dotnetExe} - skipping shortcut`);
        return;
    }
    if (!existsSync(toolDll)) {
        console.log(`[sandbox:launch] WARNING: CheckShortcut not staged: ${toolDll} - skipping shortcut`);
        return;
    }
    if (!existsSync(iconPath)) {
        console.log(`[sandbox:launch] WARNING: app icon not found: ${iconPath} - skipping shortcut`);
        return;
    }
    try {
        mkdirSync(shortcutDir, { recursive: true });
        const proc = spawnSync(dotnetExe, [
            toolDll,
            "write",
            shortcutPath,
            appExe,
            iconPath,
            "--aumid", aumid,
            "--name", shortcutName,
        ]);
        const output = `${proc.stdout ?? ""}${proc.stderr ?? ""}`.trim().replace(/\s+/g, " ");
        console.log(`[sandbox:launch] shortcut (${shortcutName} -> ${aumid}): exit=${proc.status} ${output}`);
    } catch (e) {
        console.log(`[sandbox:launch] WARNING: could not create Start Menu shortcut: ${e instanceof Error ? e.message : String(e)}`);
    }
}

// Evidence for the host: Start Menu registration (Get-StartApps), the guest
// AppUserModelId registry tree, and the AUMID actually stamped on the .lnk.
// Written to the sync folder right after shortcut creation.
function writeIdentityReport(): void {
    const { name: shortcutName, aumid } = shortcutIdentity();
    const shortcutPath = resolve(
        process.env["APPDATA"] ?? "",
        "Microsoft", "Windows", "Start Menu", "Programs", `${shortcutName}.lnk`,
    );

    const psJson = (command: string): unknown => {
        const res = spawnSync("powershell", ["-NoProfile", "-Command", command]);
        const text = (res.stdout ?? "").toString().trim();
        if (res.status !== 0 || !text) return [];
        try {
            const parsed = JSON.parse(text) as unknown;
            // PowerShell emits a bare object for a single match - normalize to an array.
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return text;
        }
    };

    const toolDll = resolve(payloadRoot, "scripts", "CheckShortcut", "CheckShortcut.dll");
    const dotnetExe = resolve("C:\\KuumoDotnet", "dotnet.exe");
    let readback = "(CheckShortcut read skipped)";
    if (existsSync(dotnetExe) && existsSync(toolDll) && existsSync(shortcutPath)) {
        const res = spawnSync(dotnetExe, [toolDll, "read", shortcutPath]);
        readback = `${res.stdout ?? ""}${res.stderr ?? ""}`.trim();
    }

    const report = {
        at: new Date().toISOString(),
        launch: meta.launch,
        aumid,
        shortcut: {
            path: shortcutPath,
            exists: existsSync(shortcutPath),
            read: readback,
        },
        startApps: psJson(
            "Get-StartApps | Where-Object { $_.Name -match 'kuumo' -or $_.AppID -match 'kuumo' } | ConvertTo-Json -Compress",
        ),
        registryKeys: psJson(
            "Get-ChildItem 'HKCU:\\Software\\Classes\\AppUserModelId' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match 'kuumo' } | Select-Object -ExpandProperty PSChildName | ConvertTo-Json -Compress",
        ),
    };
    try {
        writeFileSync("C:\\KuumoSync\\identity.json", JSON.stringify(report, null, 2) + "\n");
        console.log("[sandbox:launch] wrote identity.json");
    } catch {
        console.log("[sandbox:launch] WARNING: could not write identity.json (sync folder missing?)");
    }
}


async function runCycle(): Promise<CycleResult> {
    console.log("[sandbox:launch] waiting for backend endpoint...");
    // First execution in a fresh VM can still be slow (cold caches, one-time
    // JIT), so allow a generous window before declaring failure. provision.ps1
    // excludes the payload dirs from Defender, so this is no longer a scan delay.
    const deadline = Date.now() + 45_000;
    let wsUrl: string | null = null;
    let lastId = getMaxLogId();
    const freshLogs: string[] = [];
    while (Date.now() < deadline) {
        await Bun.sleep(1000);
        const rows = readFreshLogs(lastId);
        if (rows.length > 0) {
            lastId = rows[rows.length - 1].id;
            freshLogs.push(...rows.map((r) => r.message));
            // Capture group 1 only: the full match would include the
            // "KUUMO_WS=" prefix, which the status file and the RPC smoke
            // test both need stripped.
            const matches = rows
                .flatMap((r) => [...r.message.matchAll(/KUUMO_WS=(ws:\/\/[^\s]+)/g)].map((m) => m[1]));
            const match = matches[matches.length - 1];
            if (match) {
                wsUrl = match;
                break;
            }
        }
    }

    const problems = freshLogs
        .filter((line) => /UNHANDLED|\[theme\] .* failed|load failed|accent failed/.test(line))
        .slice(-10);

    const result: CycleResult = {
        endpoint: wsUrl,
        problems,
        alive: appIsRunning(),
        spawnExit,
    };
    // Always export diagnostics: the host audits the backend log after every
    // cycle, healthy or not (snapshot works while the backend is running).
    copyDiagnostics();
    lastResult = result;
    printSummary(result);
    writeStatus(result);
    return result;
}

function printSummary(result: CycleResult): void {
    console.log("[sandbox:launch] status:");
    console.log(`  endpoint:  ${result.endpoint ?? "(not found in log)"}`);
    console.log(`  app alive: ${result.alive ? "yes" : "NO"}`);
    if (result.spawnExit !== null) console.log(`  app exited with code ${result.spawnExit}`);
    if (result.problems.length > 0) {
        console.log("  problems:");
        for (const line of result.problems) console.log(`    ${line}`);
    } else {
        console.log("  problems:  none");
    }
}

// Safe-to-run RPC groups: playback/server-push need an audio device (none in
// the sandbox), and youtube-user requires an interactive Google sign-in.
const SMOKE_GROUPS = [
    "connection",
    "home",
    "search",
    "youtube",
    "queue",
    "settings",
    "local",
    "logs",
    "downloads",
    "google",
    "discord",
    "sleep",
    "image-cache",
];

// Runs the staged RPC test suite against the live endpoint from inside the
// guest (the host cannot reliably reach the sandbox's NATed address). Full
// output goes to C:\KuumoSync\rpc-test.log; the parsed summary lands in
// status.json so the host can assert on it.
async function runSmokeTest(endpoint: string): Promise<SmokeResult> {
    const testRpc = resolve(payloadRoot, "scripts", "test-rpc.ts");
    const result: SmokeResult = { passed: 0, failed: 0, skipped: 0, failures: [] };
    if (!existsSync(testRpc)) {
        result.failed = 1;
        result.failures.push({ test: "(setup)", error: `test-rpc.ts not found: ${testRpc}` });
        return result;
    }
    const logPath = "C:\\KuumoSync\\rpc-test.log";
    let logText = `# RPC smoke test against ${endpoint} at ${new Date().toISOString()}\n`;
    console.log("[sandbox:launch] running RPC smoke test...");
    for (const group of SMOKE_GROUPS) {
        const started = Date.now();
        const proc = Bun.spawn(
            [process.execPath, testRpc, `--ws-url=${endpoint}`, `--group=${group}`],
            { stdout: "pipe", stderr: "pipe" },
        );
        // A wedged group (e.g. network stall) must not hold the whole run:
        // kill it after 60s and record a timeout failure.
        const [stdout, stderr, outcome] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            Promise.race([
                proc.exited.then((code) => ({ exited: code as number | null })),
                Bun.sleep(60_000).then(() => {
                    try {
                        proc.kill();
                    } catch {
                        // already exited
                    }
                    return { timeout: true as const };
                }),
            ]),
        ]);
        const timedOut = "timeout" in outcome;
        const exitCode = timedOut ? 124 : (outcome.exited ?? -1);
        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        logText += `\n===== group: ${group} (exit ${exitCode}, ${elapsed}s) =====\n${stdout}${stderr}`;
        // Strip ANSI codes before parsing the summary lines.
        const clean = (stdout + stderr).replace(/\x1b\[[0-9;]*m/g, "");
        const passed = clean.match(/Passed:\s*(\d+)/);
        const failed = clean.match(/Failed:\s*(\d+)/);
        const skipped = clean.match(/Skipped:\s*(\d+)/);
        if (exitCode === 124 || /Fatal:/.test(clean)) {
            const reason = exitCode === 124 ? "group timed out after 60s" : clean.match(/Fatal: (.*)/)?.[1] ?? `exit ${exitCode}`;
            result.failed += 1;
            result.failures.push({ test: `${group} (group)`, error: reason });
            console.log(`  ${group}: GROUP FAILURE - ${reason}`);
        } else {
            result.passed += passed ? parseInt(passed[1], 10) : 0;
            result.failed += failed ? parseInt(failed[1], 10) : 0;
            result.skipped += skipped ? parseInt(skipped[1], 10) : 0;
            // The suite's trailing "Failures:" block pairs each failed test
            // name with its error message (inline ✗ marks have no message).
            const failuresBlock = clean.match(/Failures:\s*\n([\s\S]*)$/);
            if (failuresBlock) {
                const lines = failuresBlock[1].split("\n");
                for (let i = 0; i < lines.length; i++) {
                    const name = lines[i].match(/^\s*✗\s+(.+)$/);
                    if (!name) continue;
                    const error = (lines[i + 1] ?? "").match(/^\s{2,}(.+)$/);
                    result.failures.push({ test: `${group}: ${name[1].trim()}`, error: error ? error[1].trim() : "" });
                }
            }
            console.log(`  ${group}: ${failed && failed[1] !== "0" ? `FAILED (${failed[1]})` : "ok"}`);
        }
        // Flush after every group so a mid-run teardown still leaves the
        // partial log for the host to inspect.
        try {
            writeFileSync(logPath, logText);
        } catch {
            // sync folder only exists inside the sandbox
        }
    }
    return result;
}

// Smoke is opt-in everywhere: the host asks for it with --smoke (carried in
// the stage manifest) or you trigger it with the `s` console command.
async function runAndRecordSmoke(endpoint: string): Promise<void> {
    try {
        smokeResult = await runSmokeTest(endpoint);
        console.log(
            `[sandbox:launch] smoke test: ${smokeResult.passed} passed, ${smokeResult.failed} failed, ${smokeResult.skipped} skipped`,
        );
        if (lastResult) writeStatus(lastResult, { smoke: smokeResult });
    } catch (e) {
        console.log(`[sandbox:launch] WARNING: smoke test crashed: ${e instanceof Error ? e.message : String(e)}`);
    }
}

// Host restaged while this session is live (bun run sandbox:run/sandbox:sync
// with the window open): refresh the local payload in place, then relaunch.
// The guest database, Start Menu shortcut and runtime installs all survive -
// that is the whole point of syncing instead of rebooting the VM.
async function handleStageUpdate(stageNonce: string): Promise<void> {
    const manifest = readManifest(stageManifestPath);
    const smokeRequested = manifest?.smoke === true;
    console.log(`[sandbox:launch] stage manifest ${stageNonce.slice(0, 8)} from host - syncing payload...`);
    watching = false;
    killAll();
    // Stop-Process is asynchronous-ish: give the app and its backend a moment
    // to release file locks before robocopy touches their binaries.
    for (let i = 0; i < 15 && appIsRunning(); i++) {
        await Bun.sleep(200);
    }

    let synced = false;
    for (let attempt = 1; attempt <= 3 && !synced; attempt++) {
        const proc = spawnSync("powershell", [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            resolve(payloadRoot, "scripts", "sync.ps1"),
        ]);
        const output = `${proc.stdout ?? ""}${proc.stderr ?? ""}`.trim().replace(/\s+/g, " ");
        synced = proc.status === 0;
        if (!synced) {
            console.log(`[sandbox:launch] payload sync attempt ${attempt}/3 failed (exit ${proc.status}) ${output}`);
            if (attempt < 3) await Bun.sleep(2000);
        }
    }
    if (!synced) {
        console.log("[sandbox:launch] WARNING: payload sync failed - continuing with the previous payload (re-run the sync, or --fresh for a clean copy)");
        syncedNonce = stageNonce;
        watching = appIsRunning();
        return;
    }

    syncedNonce = manifestNonce(payloadManifestPath) ?? stageNonce;
    console.log(`[sandbox:launch] payload synced (${stageNonce.slice(0, 8)}) - relaunching app...`);
    spawnApp();
    const result = await runCycle();
    watching = result.alive;
    writeStatus(result, { stageNonce });
    if (smokeRequested && result.alive && result.endpoint !== null) {
        await runAndRecordSmoke(result.endpoint);
    }
}

console.log(`[sandbox:launch] payload: ${payloadRoot}`);
console.log(`[sandbox:launch] target=${meta.target} launch=${meta.launch}`);

if (!existsSync(appExe)) {
    console.error(`[sandbox:launch] exe not found: ${appExe}`);
    process.exit(1);
}

seedGuestDb();
ensureStartMenuShortcut();
// Pre-spawn report: captures the externally created shortcut even if the app
// never starts. A second report after the first cycle also captures what the
// app registered in-process (Avalonia writes its AppUserModelId registry key
// and validates the shortcut during startup).
writeIdentityReport();
killAll();
spawnApp();
let initialResult = await runCycle();
if (!initialResult.alive) {
    console.log("[sandbox:launch] app not running after first attempt - retrying once...");
    killAll();
    spawnApp();
    initialResult = await runCycle();
}
writeIdentityReport();

const bootSmokeRequested = readManifest(stageManifestPath)?.smoke === true;
if (initialResult.alive && initialResult.endpoint !== null && bootSmokeRequested) {
    await runAndRecordSmoke(initialResult.endpoint);
}

const isTTY = process.stdin.isTTY === true;

if (!isTTY) {
    // No console to type into, but a host restage must still be honoured.
    while (appIsRunning()) {
        await Bun.sleep(2000);
        const stageNonce = manifestNonce(stageManifestPath);
        if (stageNonce !== null && stageNonce !== syncedNonce) {
            await handleStageUpdate(stageNonce);
        }
    }
    killAll();
    const base: CycleResult = lastResult ?? { endpoint: null, problems: [], alive: false, spawnExit };
    writeStatus({ ...base, alive: false, spawnExit }, { stoppedAt: new Date().toISOString(), stopReason: "app exited (non-interactive run)" });
    process.exit(initialResult.alive ? 0 : 1);
}

const HELP = [
    "[sandbox:launch] commands:",
    "  q, quit        stop the app/backend and exit",
    "  r, relaunch    kill and start the app again",
    "  s, smoke       run the RPC smoke test against the live endpoint",
    "  h, help        show this help",
    "  Ctrl+C         same as q",
    "",
    "a host restage (bun run sandbox:run / sandbox:sync) is picked up",
    "automatically - no need to restart the sandbox.",
].join("\n");

let tearingDown = false;
const teardown = (reason: string) => {
    if (tearingDown) return;
    tearingDown = true;
    console.log(`[sandbox:launch] ${reason}`);
    killAll();
    // Preserve the latest cycle's evidence (endpoint/problems/smoke) and mark
    // the stop explicitly - the host distinguishes an intentional close from
    // a crash by stoppedAt/stopReason rather than a nulled endpoint.
    const base: CycleResult = lastResult ?? { endpoint: null, problems: [], alive: false, spawnExit };
    writeStatus({ ...base, alive: false, spawnExit }, { stoppedAt: new Date().toISOString(), stopReason: reason });
    process.exit(0);
};

watching = initialResult.alive;
const WATCH_INTERVAL_MS = 1000;

const watchLoop = async () => {
    while (true) {
        await Bun.sleep(WATCH_INTERVAL_MS);
        // Host restaged: fresh nonce in stage\manifest.json -> refresh in place.
        const stageNonce = manifestNonce(stageManifestPath);
        if (stageNonce !== null && stageNonce !== syncedNonce) {
            await handleStageUpdate(stageNonce);
            continue;
        }
        if (watching && !appIsRunning()) {
            teardown("app exited - stopping dev run");
            return;
        }
    }
};

process.on("SIGINT", () => {
    console.log();
    teardown("Ctrl+C - stopping dev run");
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on("close", () => {
    if (tearingDown) return;
    // The LogonCommand window may deliver stdin EOF even though the console
    // stays visible: keep the app running in that case instead of killing it.
    if (appIsRunning()) {
        console.log("[sandbox:launch] stdin closed - keeping the app running (watch mode)");
        watching = true;
        return;
    }
    teardown("stdin closed - stopping dev run");
});
rl.on("line", async (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === "q" || cmd === "quit") {
        teardown("stopping dev run");
        return;
    }
    if (cmd === "r" || cmd === "relaunch") {
        watching = false;
        killAll();
        spawnApp();
        const result = await runCycle();
        watching = result.alive;
        rl.prompt();
        return;
    }
    if (cmd === "s" || cmd === "smoke") {
        const endpoint = lastResult?.endpoint ?? null;
        if (!endpoint || !appIsRunning()) {
            console.log("[sandbox:launch] no live endpoint - the app is not running (try r first)");
        } else {
            await runAndRecordSmoke(endpoint);
        }
        rl.prompt();
        return;
    }
    if (cmd === "h" || cmd === "help" || cmd === "?") {
        console.log(HELP);
    } else if (cmd.length > 0) {
        console.log("[sandbox:launch] unknown command (q=stop, r=relaunch, s=smoke, h=help)");
    }
    rl.prompt();
});

void watchLoop();
console.log("[sandbox:launch] dev run active - restage from the host with sandbox:run/sandbox:sync.");
rl.prompt();
