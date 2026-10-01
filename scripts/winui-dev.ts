import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Database } from "bun:sqlite";
import readline from "node:readline";
import {
    WINUI_DEV_SHORTCUT,
    removeWinuiDevArtifacts,
    startMenuProgramsDir,
} from "./dev-artifacts.ts";

const root = resolve(import.meta.dir, "..");
const PROFILE = "myown";
const dataDir = resolve(process.env["APPDATA"] ?? "", "KuumoApp");
const logDbPath = resolve(dataDir, "app_data.sqlite");

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

const profileFile = resolve(root, "apikeys", `${PROFILE}.json`);
if (!existsSync(profileFile)) {
    console.error(`Missing profile file: ${profileFile}`);
    process.exit(1);
}

// Bake the profile's credentials (encrypted keys + googleClientId) into data/system.json.
const encrypt = spawnSync("bun", ["./scripts/encrypt-credentials.ts", "--profile", PROFILE], {
    cwd: root,
    stdio: "inherit",
});
if (encrypt.status !== 0) process.exit(encrypt.status ?? 1);
const appExe = resolve(
    root,
    "app-winui",
    "KuumoApp",
    "bin",
    "x64",
    "Debug",
    "net10.0-windows10.0.22621.0",
    "win-x64",
    "KuumoApp.exe",
);
const skipBackend = process.argv.includes("--skip-backend");
const skipWinui = process.argv.includes("--skip-winui");
const stopOnly = process.argv.includes("--stop");
const forceTakeover = process.argv.includes("--force");
const isTTY = process.stdin.isTTY === true;

function psQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function ps(command: string): string {
    const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
        encoding: "utf8",
        windowsHide: true,
    });
    return String(result.stdout ?? "");
}

// Everything the shared %APPDATA%\KuumoApp data dir is written by: any KuumoApp.exe,
// plus any bun backend launched with that exact --data-dir. Matching on the full
// `--data-dir <path>` keeps this script itself (repo path contains "kuumoapp",
// case-insensitively) and `bun run dev` (data dir = <root>\data\dev) out of the net.
const sharedDataDirMatcher = `*--data-dir ${dataDir}*`;

const KILL_SCRIPT = [
    "Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | Stop-Process -Force",
    `Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^bun' -and $_.CommandLine -like ${psQuote(sharedDataDirMatcher)} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    "exit 0",
].join("; ");

// A KuumoApp.exe running from anywhere other than this checkout means somebody else
// (the installed build, or the other frontend) owns the shared sqlite. Refuse to start
// rather than silently taking their database over.
function findForeignApps(): string[] {
    const command = [
        "Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | ForEach-Object {",
        "  $p = ''; try { $p = $_.Path } catch { }",
        `  if ($p -and $p -ne ${psQuote(appExe)}) { [Console]::Out.WriteLine($p) }`,
        "}",
    ].join("\r\n");
    const lines = ps(command)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    return [...new Set(lines)];
}

function assertNoForeignOwner(): void {
    const foreign = findForeignApps();
    if (foreign.length === 0) return;
    if (!forceTakeover) {
        console.error("\n[winui:dev] another KuumoApp is already running:");
        for (const path of foreign) console.error(`  ${path}`);
        console.error(`  both share the same data dir: ${dataDir}`);
        console.error("  close it first, or re-run with --force to stop it.\n");
        process.exit(1);
    }
    console.log("[winui:dev] --force: taking over from:");
    for (const path of foreign) console.log(`  ${path}`);
}

function killAll() {
    spawnSync("powershell", ["-NoProfile", "-Command", KILL_SCRIPT], { stdio: "inherit" });
}

function appIsRunning() {
    const check = spawnSync("powershell", [
        "-NoProfile",
        "-Command",
        "Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id",
    ]);
    return check.stdout?.toString().trim().length > 0;
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
    const result = spawnSync(cmd, args, {
        cwd: opts.cwd ?? root,
        env: opts.env ? { ...process.env, ...opts.env } : process.env,
        stdio: "inherit",
        shell: false,
    });
    if (result.status !== 0) {
        console.error(`\n[winui:dev] ${cmd} failed (exit ${result.status})`);
        process.exit(result.status ?? 1);
    }
}

async function runDevCycle(): Promise<boolean> {
    assertNoForeignOwner();

    console.log("[winui:dev] killing running app/backend...");
    killAll();
    // Sweep leftovers from a session that died without running its teardown.
    removeWinuiDevArtifacts();

    if (skipBackend) {
        console.log("[winui:dev] skipping backend rebuild (--skip-backend)");
    } else {
        console.log("[winui:dev] rebuilding backend bundle...");
        run("bun", ["run", "--silent", "build:prod", "--", "--dev"], { cwd: root });
    }

    if (skipWinui) {
        console.log("[winui:dev] skipping WinUI build (--skip-winui)");
    } else {
        console.log("[winui:dev] building WinUI app...");
        run(
            "dotnet",
            [
                "build",
                "--no-restore",
                "-m",
                "app-winui\\KuumoApp\\KuumoApp.csproj",
                "-p:Platform=x64",
                "-p:WindowsAppSDKSelfContained=false",
            ],
            { cwd: root },
        );
    }

    if (!existsSync(appExe)) {
        console.error(`\n[winui:dev] exe not found: ${appExe}`);
        process.exit(1);
    }

    console.log("[winui:dev] ensuring Start Menu shortcut with AUMID...");
    run("dotnet", ["run", "--project", "scripts\\CheckShortcut\\CheckShortcut.csproj", "--", "write", "--aumid", "kuumo.app.dev", "--name", WINUI_DEV_SHORTCUT], { cwd: root });

    const shortcutPath = resolve(startMenuProgramsDir(), `${WINUI_DEV_SHORTCUT}.lnk`);
    if (!existsSync(shortcutPath)) {
        console.error(`[winui:dev] WARNING: ${shortcutPath} was not created - SMTC will fall back to a generic name`);
    }

    console.log("[winui:dev] launching app...");
    // Bun.spawn's `env` replaces the parent environment rather than extending it,
    // so spread process.env first - without it the app comes up with no %APPDATA%,
    // %LOCALAPPDATA% or %PROGRAMFILES%.
    Bun.spawn([appExe], {
        cwd: root,
        env: {
            ...process.env,
            KUUMO_DEV: "1",
            // Main() ignores argv, so the data dir has to travel as an env var.
            KUUMO_DATA_DIR: dataDir,
            KUUMO_BACKEND_DIR: resolve(root, "build"),
            KUUMO_ASSETS_DIR: root,
        },
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
    });

    console.log("[winui:dev] waiting for backend endpoint...");
    const deadline = Date.now() + 20_000;
    let wsUrl: string | null = null;
    let lastId = getMaxLogId();
    const freshLogs: string[] = [];
    while (Date.now() < deadline) {
        await Bun.sleep(1000);
        const rows = readFreshLogs(lastId);
        if (rows.length > 0) {
            lastId = rows[rows.length - 1].id;
            freshLogs.push(...rows.map((r) => r.message));
            const matches = rows
                .flatMap((r) => r.message.match(/KUUMO_WS=(ws:\/\/[^\s]+)/g) ?? []);
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

    const alive = appIsRunning();

    console.log("[winui:dev] done:");
    console.log(`  endpoint:  ${wsUrl ?? "(not found in log)"}`);
    console.log(`  app alive: ${alive ? "yes" : "NO"}`);
    if (problems.length > 0) {
        console.log("  problems:");
        for (const line of problems) console.log(`    ${line}`);
    } else {
        console.log("  problems:  none");
    }
    return alive;
}

if (stopOnly) {
    console.log("[winui:dev] stopping dev run...");
    await stopDevRun();
    process.exit(0);
}

const initialAlive = await runDevCycle();

if (!isTTY) {
    console.log("[winui:dev] non-interactive, exiting.");
    process.exit(initialAlive ? 0 : 1);
}

const HELP = [
    "[winui:dev] commands:",
    "  q, quit        stop the app/backend, remove the dev shortcut, and exit",
    "  r, restart     kill, rebuild, and relaunch (backend too unless --skip-backend)",
    "  h, help        show this help",
    "  Ctrl+C         same as q",
    "",
    "[winui:dev] flags:",
    "  --force        take the shared data dir over from another KuumoApp",
    "  --stop         stop a running dev session without rebuilding",
    "  --skip-backend --skip-winui",
].join("\n");

// Stops only what belongs to this dev session: if a foreign KuumoApp appeared
// mid-run it is left alone, so an installed build never loses its data or shortcut.
async function stopDevRun(): Promise<void> {
    const foreign = findForeignApps();
    if (foreign.length === 0) {
        killAll();
    } else {
        console.log("[winui:dev] leaving foreign KuumoApp running:");
        for (const path of foreign) console.log(`  ${path}`);
        spawnSync(
            "powershell",
            ["-NoProfile", "-Command",
                `Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq ${psQuote(appExe)} } | Stop-Process -Force`],
            { stdio: "inherit" },
        );
    }
    // Give a process that is mid-startup time to finish before its artifacts go.
    await Bun.sleep(500);
    removeWinuiDevArtifacts();
}

let tearingDown = false;
const teardown = async (reason: string) => {
    if (tearingDown) return;
    tearingDown = true;
    console.log(`[winui:dev] ${reason}`);
    await stopDevRun();
    process.exit(0);
};

let watching = false;
const WATCH_INTERVAL_MS = 2000;

const watchLoop = async () => {
    while (true) {
        await Bun.sleep(WATCH_INTERVAL_MS);
        if (watching && !appIsRunning()) {
            void teardown("app exited - stopping dev run");
            return;
        }
    }
};

process.on("SIGINT", () => {
    console.log();
    void teardown("Ctrl+C - stopping dev run");
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on("close", () => {
    if (!tearingDown) void teardown("stdin closed - stopping dev run");
});
rl.on("line", async (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === "q" || cmd === "quit") {
        void teardown("stopping dev run");
        return;
    }
    if (cmd === "r" || cmd === "restart" || cmd === "relaunch") {
        watching = false;
        const alive = await runDevCycle();
        watching = alive;
        rl.prompt();
        return;
    }
    if (cmd === "h" || cmd === "help" || cmd === "?") {
        console.log(HELP);
    } else if (cmd.length > 0) {
        console.log("[winui:dev] unknown command (q=stop, r=rebuild+relaunch, h=help)");
    }
    rl.prompt();
});

watching = initialAlive;
void watchLoop();
console.log("[winui:dev] dev run active - app keeps running until you quit.");
rl.prompt();
