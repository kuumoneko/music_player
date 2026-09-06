import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(import.meta.dir, "..");
const PROFILE = "myown";

// --- Args ---
const args = process.argv.slice(2);
const wsUrl = args.find((a) => a.startsWith("--ws-url="))?.split("=")[1];
const groupFilter = args.find((a) => a.startsWith("--group="))?.split("=")[1];
const verbose = args.includes("--verbose");

// --- Colors ---
const green = "\x1b[32m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const dim = "\x1b[2m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: { test: string; error: string }[] = [];

// --- RPC Client ---
let ws: WebSocket;
let nextId = 1;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function call(method: string, params?: unknown, timeoutMs = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws = null as any;

function pass(name: string) {
  passed++;
  console.log(`  ${green}✓${reset} ${name}`);
}

function fail(name: string, error: unknown) {
  failed++;
  const msg = error instanceof Error ? error.message : String(error);
  failures.push({ test: name, error: msg });
  console.log(`  ${red}✗${reset} ${name}`);
  if (verbose) console.log(`    ${dim}${msg}${reset}`);
}

function skip(name: string, reason: string) {
  skipped++;
  console.log(`  ${yellow}○${reset} ${name} ${dim}(${reason})${reset}`);
}

async function test(name: string, fn: () => Promise<any>): Promise<any> {
  try {
    const result = await fn();
    pass(name);
    return result;
  } catch (e) {
    fail(name, e);
    return undefined;
  }
}

// --- Test Groups ---
type TestGroup = {
  name: string;
  tests: (() => Promise<void>)[];
};

function defineGroups(): TestGroup[] {
  const groups: TestGroup[] = [];

  // --- connection ---
  groups.push({
    name: "connection",
    tests: [
      () => test("getIsLocal", async () => {
        const result = await call("getIsLocal");
        if (typeof result !== "boolean") throw new Error(`expected boolean, got ${typeof result}`);
      }),
      () => test("getPlayingData", async () => {
        const result = await call("getPlayingData");
        if (result === null || result === undefined) throw new Error("got null/undefined");
        if (typeof result !== "object") throw new Error(`expected object, got ${typeof result}`);
      }),
      () => test("getUserData (current)", async () => {
        await call("getUserData", "current");
      }),
    ],
  });

  // --- home ---
  groups.push({
    name: "home",
    tests: [
      () => test("getHomeData", async () => {
        const result = await call("getHomeData");
        if (result === null || result === undefined) throw new Error("got null/undefined");
      }),
      () => test("getHomeFeed", async () => {
        const result = await call("getHomeFeed");
        if (result === null || result === undefined) throw new Error("got null/undefined");
      }),
      () => test("getHomeArtists", async () => {
        const result = await call("getHomeArtists");
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
      }),
      () => test("getHomePlaylists", async () => {
        const result = await call("getHomePlaylists");
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
      }),
      () => test("getHomeTracks", async () => {
        const result = await call("getHomeTracks");
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
      }),
      () => test("getHomeNewTracks", async () => {
        const result = await call("getHomeNewTracks");
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
      }),
    ],
  });

  // --- search ---
  groups.push({
    name: "search",
    tests: [
      () => test("searchMusic (tracks)", async () => {
        const result = await call("searchMusic", { type: "track", source: "youtube", query: "never gonna give you up" });
        if (result === null || result === undefined) throw new Error("got null/undefined");
      }),
      () => test("searchMusic (playlists)", async () => {
        const result = await call("searchMusic", { type: "playlist", source: "youtube", query: "music" });
        if (result === null || result === undefined) throw new Error("got null/undefined");
      }),
      () => test("searchMusic (artists)", async () => {
        const result = await call("searchMusic", { type: "artist", source: "youtube", query: "rick astley" });
        if (result === null || result === undefined) throw new Error("got null/undefined");
      }),
    ],
  });

  // --- playback ---
  let playbackTrackId: string | null = null;
  groups.push({
    name: "playback",
    tests: [
      () => test("getMusicData (track)", async () => {
        const result = await call("getMusicData", { source: "youtube", type: "track", id: "dQw4w9WgXcQ" });
        if (result === null || result === undefined) throw new Error("got null/undefined");
        if (result.id) playbackTrackId = result.id;
      }),
      () => test("play (rickroll)", async () => {
        if (!playbackTrackId) {
          skip("play", "no track ID from getMusicData");
          return;
        }
        await call("play", { item: "youtube:track:" + playbackTrackId, source: "youtube", type: "track", id: playbackTrackId });
        // wait a bit for playback to start
        await new Promise((r) => setTimeout(r, 2000));
      }),
      () => test("getPlayingData (after play)", async () => {
        const result = await call("getPlayingData");
        if (result === null || result === undefined) throw new Error("got null/undefined");
      }),
      () => test("getCurrentPlaying", async () => {
        const result = await call("getCurrentPlaying");
        if (result === null || result === undefined) throw new Error("got null/undefined");
      }),
      () => test("togglePlayPause", async () => {
        await call("togglePlayPause");
        await new Promise((r) => setTimeout(r, 500));
      }),
      () => test("seekTo", async () => {
        await call("seekTo", 5);
        await new Promise((r) => setTimeout(r, 500));
      }),
      () => test("next", async () => {
        await call("next");
        await new Promise((r) => setTimeout(r, 1000));
      }),
      () => test("previous", async () => {
        await call("previous");
        await new Promise((r) => setTimeout(r, 1000));
      }),
    ],
  });

  // --- queue ---
  groups.push({
    name: "queue",
    tests: [
      () => test("getQueueData", async () => {
        const result = await call("getQueueData", []);
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
      }),
      () => test("addToBatchQueue", async () => {
        await call("addToBatchQueue", { source: "youtube", type: "track", id: "dQw4w9WgXcQ" });
      }),
    ],
  });

  // --- playlists ---
  let createdPlaylistId: string | null = null;
  groups.push({
    name: "playlists",
    tests: [
      () => test("createPlaylist", async () => {
        const result = await call("createPlaylist", "Test Playlist " + Date.now());
        if (result === null || result === undefined) throw new Error("got null/undefined");
        if (typeof result === "string") createdPlaylistId = result;
        else if (result?.id) createdPlaylistId = result.id;
      }),
      () => test("getUserPlaylists", async () => {
        const result = await call("getUserPlaylists");
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
      }),
      () => test("addToPlaylist", async () => {
        if (!createdPlaylistId) {
          skip("addToPlaylist", "no playlist created");
          return;
        }
        await call("addToPlaylist", { playlistId: createdPlaylistId, trackId: "dQw4w9WgXcQ", source: "youtube" });
      }),
      () => test("removeFromPlaylist", async () => {
        if (!createdPlaylistId) {
          skip("removeFromPlaylist", "no playlist created");
          return;
        }
        await call("removeFromPlaylist", { playlistId: createdPlaylistId, trackId: "dQw4w9WgXcQ" });
      }),
      () => test("deletePlaylist", async () => {
        if (!createdPlaylistId) {
          skip("deletePlaylist", "no playlist created");
          return;
        }
        await call("deletePlaylist", createdPlaylistId);
      }),
    ],
  });

  // --- settings ---
  groups.push({
    name: "settings",
    tests: [
      () => test("getUserData (volume)", async () => {
        await call("getUserData", "volume");
      }),
      () => test("setUserData (volume)", async () => {
        const current = await call("getUserData", "volume");
        await call("setUserData", { key: "volume", value: current ?? 80 });
      }),
      () => test("getUserData (repeat)", async () => {
        await call("getUserData", "repeat");
      }),
      () => test("getUserData (shuffle)", async () => {
        await call("getUserData", "shuffle");
      }),
      () => test("isQuitOnClose", async () => {
        const result = await call("isQuitOnClose");
        if (typeof result !== "boolean") throw new Error(`expected boolean, got ${typeof result}`);
      }),
      () => test("toggleQuitOnClose", async () => {
        const before = await call("isQuitOnClose");
        await call("toggleQuitOnClose");
        const after = await call("isQuitOnClose");
        // toggle back to restore original state
        if (before !== after) await call("toggleQuitOnClose");
      }),
    ],
  });

  // --- downloads ---
  groups.push({
    name: "downloads",
    tests: [
      () => test("getDownloadStatus", async () => {
        const result = await call("getDownloadStatus");
        // can be null if not local mode — that's ok
        if (verbose) console.log(`    ${dim}status: ${JSON.stringify(result)}${reset}`);
      }),
    ],
  });

  // --- youtube ---
  groups.push({
    name: "youtube",
    tests: [
      () => test("getYoutubeApiKeys", async () => {
        const result = await call("getYoutubeApiKeys");
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
      }),
      () => test("getYtCookies", async () => {
        await call("getYtCookies");
      }),
      () => test("resolveThumbnailUrl (track)", async () => {
        const result = await call("resolveThumbnailUrl", { id: "dQw4w9WgXcQ", type: "track" });
        if (verbose) console.log(`    ${dim}url: ${result}${reset}`);
      }),
      () => test("getImageDataUri", async () => {
        const result = await call("getImageDataUri", "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg");
        if (typeof result === "string" && !result.startsWith("data:")) {
          throw new Error(`expected data URI, got: ${result.substring(0, 80)}`);
        }
      }),
    ],
  });

  // --- discord ---
  groups.push({
    name: "discord",
    tests: [
      () => test("isHasDiscordRPC", async () => {
        const result = await call("isHasDiscordRPC");
        // returns username string, false, or null — all valid
        if (verbose) console.log(`    ${dim}status: ${JSON.stringify(result)}${reset}`);
      }),
    ],
  });

  // --- google ---
  groups.push({
    name: "google",
    tests: [
      () => test("getGoogleAuthStatus", async () => {
        const result = await call("getGoogleAuthStatus");
        if (verbose) console.log(`    ${dim}status: ${JSON.stringify(result)}${reset}`);
      }),
    ],
  });

  // --- sleep ---
  groups.push({
    name: "sleep",
    tests: [
      () => test("setSleep (off)", async () => {
        await call("setSleep", "off");
      }),
    ],
  });

  // --- logs ---
  groups.push({
    name: "logs",
    tests: [
      () => test("writeLog", async () => {
        await call("writeLog", { type: "info", source: "test", message: "test-rpc log entry" });
      }),
      () => test("sendError", async () => {
        await call("sendError", { message: "test-rpc error (intentional)" });
      }),
    ],
  });

  // --- local ---
  groups.push({
    name: "local",
    tests: [
      () => test("getLocalfile", async () => {
        const result = await call("getLocalfile");
        if (!Array.isArray(result)) throw new Error(`expected array, got ${typeof result}`);
        if (verbose) console.log(`    ${dim}files: ${result.length}${reset}`);
      }),
    ],
  });

  // --- ui ---
  groups.push({
    name: "ui",
    tests: [
      () => test("setUiVisibility (true)", async () => {
        await call("setUiVisibility", true);
      }),
      () => test("setUiVisibility (false)", async () => {
        await call("setUiVisibility", false);
      }),
    ],
  });

  return groups;
}

// --- Backend Spawning ---
async function spawnBackend(): Promise<string> {
  const profileFile = resolve(root, "apikeys", `${PROFILE}.json`);
  if (!existsSync(profileFile)) {
    console.error(`${red}Missing profile: ${profileFile}${reset}`);
    process.exit(1);
  }

  // Encrypt credentials
  const { spawnSync } = await import("node:child_process");
  const encrypt = spawnSync("bun", ["./scripts/encrypt-credentials.ts", "--profile", PROFILE], {
    cwd: root,
    stdio: "pipe",
  });
  if (encrypt.status !== 0) {
    console.error(`${red}Failed to encrypt credentials${reset}`);
    process.exit(1);
  }

  const devDataDir = resolve(root, "data", "dev");
  const child = Bun.spawn(
    ["bun", "src/bun/index.ts", "--data-dir", devDataDir, "--assets", root, "--port", "0", "--no-lock"],
    { cwd: root, stdio: ["pipe", "pipe", "pipe"] }
  );

  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Backend startup timed out after 30s"));
    }, 30000);

    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("KUUMO_WS=")) {
            clearTimeout(timeout);
            console.log(`${dim}backend pid: ${child.pid}${reset}`);
            resolve(line.slice("KUUMO_WS=".length));
            return;
          }
          if (line.startsWith("KUUMO_ERROR=")) {
            clearTimeout(timeout);
            child.kill();
            reject(new Error(`Backend startup error: ${line.slice("KUUMO_ERROR=".length)}`));
            return;
          }
          if (verbose) console.log(`  ${dim}[backend] ${line}${reset}`);
        }
      }
    })();

    // Also read stderr
    const errReader = child.stderr.getReader();
    (async () => {
      while (true) {
        const { done, value } = await errReader.read();
        if (done) break;
        if (verbose) console.log(`  ${dim}[stderr] ${decoder.decode(value)}${reset}`);
      }
    })();
  });
}

// --- Main ---
async function main() {
  console.log(`\n${bold}KuumoApp RPC Test Suite${reset}\n`);

  // Connect or spawn
  let endpoint = wsUrl;

  if (!endpoint) {
    console.log(`${dim}No --ws-url specified, spawning backend...${reset}`);
    endpoint = await spawnBackend();
  }

  console.log(`${dim}Connecting to ${endpoint}...${reset}\n`);

  // Connect WebSocket
  await new Promise<void>((resolve, reject) => {
    ws = new WebSocket(endpoint!);

    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error(`WebSocket error: ${e}`));
    ws.onclose = (e) => reject(new Error(`WebSocket closed: ${e.code} ${e.reason}`));
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(String(e.data));
        if (data.id !== undefined && pending.has(data.id)) {
          const p = pending.get(data.id)!;
          pending.delete(data.id);
          if (data.error) {
            p.reject(new Error(data.error.message ?? JSON.stringify(data.error)));
          } else {
            p.resolve(data.result);
          }
        }
      } catch { /* ignore parse errors */ }
    };
  });

  console.log(`${green}Connected!${reset}\n`);

  // Run tests
  const groups = defineGroups();
  const targetGroups = groupFilter ? groups.filter((g) => g.name === groupFilter) : groups;

  if (targetGroups.length === 0) {
    console.error(`${red}Unknown group: ${groupFilter}${reset}`);
    console.log(`Available groups: ${groups.map((g) => g.name).join(", ")}`);
    ws.close();
    process.exit(1);
  }

  for (const group of targetGroups) {
    console.log(`${bold}── ${group.name} ──${reset}`);
    for (const testFn of group.tests) {
      await testFn();
    }
    console.log();
  }

  // Summary
  console.log(`${bold}── Summary ──${reset}`);
  console.log(`  ${green}Passed: ${passed}${reset}`);
  if (failed > 0) console.log(`  ${red}Failed: ${failed}${reset}`);
  if (skipped > 0) console.log(`  ${yellow}Skipped: ${skipped}${reset}`);
  console.log(`  Total: ${passed + failed + skipped}`);

  if (failures.length > 0) {
    console.log(`\n${bold}${red}Failures:${reset}`);
    for (const f of failures) {
      console.log(`  ${red}✗${reset} ${f.test}`);
      console.log(`    ${dim}${f.error}${reset}`);
    }
  }

  ws.close();
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`${red}Fatal: ${e.message}${reset}`);
  process.exit(1);
});
