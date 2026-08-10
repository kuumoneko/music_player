import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Database } from "bun:sqlite";
import readline from "node:readline";

const root = resolve(import.meta.dir, "..");
const PROFILE = "myown";
const dataDir = resolve(process.env["APPDATA"] ?? "", "KuumoApp");
const legacyDataDir = resolve(process.env["LOCALAPPDATA"] ?? "", "musicapp");
const logDbPath = resolve(dataDir, "app_data.sqlite");

// One-time: copy legacy data from the old %LocalAppData%\musicapp location.
function migrateLegacyData() {
    if (existsSync(legacyDataDir) && !existsSync(logDbPath)) {
        mkdirSync(dataDir, { recursive: true });
        for (const name of ["app_data.sqlite", "app_data.sqlite-wal", "app_data.sqlite-shm"]) {
            const src = resolve(legacyDataDir, name);
            if (existsSync(src)) copyFileSync(src, resolve(dataDir, name));
        }
        console.log(`[winui:dev] migrated legacy data from ${legacyDataDir} to ${dataDir}`);
    }
}

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

migrateLegacyData();

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
const stopOnly = process.argv.includes("--stop");
const isTTY = process.stdin.isTTY === true;

const KILL_SCRIPT = [
    "Get-Process -Name KuumoApp -ErrorAction SilentlyContinue | Stop-Process -Force",
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^bun' -and $_.CommandLine -match 'backend\\.js' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    "exit 0",
].join("; ");

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
    console.log("[winui:dev] killing running app/backend...");
    killAll();

    if (skipBackend) {
        console.log("[winui:dev] skipping backend rebuild (--skip-backend)");
    } else {
        console.log("[winui:dev] rebuilding backend bundle...");
        run("bun", ["run", "--silent", "build:prod"], { cwd: root });
    }

    console.log("[winui:dev] building WinUI app...");
    run(
        "dotnet",
        [
            "build",
            "app-winui\\KuumoApp\\KuumoApp.csproj",
            "-p:Platform=x64",
            "-p:RunAnalyzersDuringBuild=false",
            "-p:DisableXbfLineInfo=true",
            "-p:WindowsAppSDKSelfContained=false",
        ],
        { cwd: root },
    );

    if (!existsSync(appExe)) {
        console.error(`\n[winui:dev] exe not found: ${appExe}`);
        process.exit(1);
    }

    console.log("[winui:dev] launching app...");
    Bun.spawn([appExe, "--data-dir", dataDir], {
        cwd: root,
        env: {
            KUUMO_DEV: "1",
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
    killAll();
    process.exit(0);
}

const initialAlive = await runDevCycle();

if (!isTTY) {
    console.log("[winui:dev] non-interactive, exiting.");
    process.exit(initialAlive ? 0 : 1);
}

const HELP = [
    "[winui:dev] commands:",
    "  q, quit        stop the app/backend and exit",
    "  r, restart     kill, rebuild, and relaunch (backend too unless --skip-backend)",
    "  h, help        show this help",
    "  Ctrl+C         same as q",
].join("\n");

let tearingDown = false;
const teardown = (reason: string) => {
    if (tearingDown) return;
    tearingDown = true;
    console.log(`[winui:dev] ${reason}`);
    killAll();
    process.exit(0);
};

let watching = false;
const WATCH_INTERVAL_MS = 2000;

const watchLoop = async () => {
    while (true) {
        await Bun.sleep(WATCH_INTERVAL_MS);
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
    if (!tearingDown) teardown("stdin closed - stopping dev run");
});
rl.on("line", async (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === "q" || cmd === "quit") {
        teardown("stopping dev run");
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
