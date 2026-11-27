// Covers withRateLimit in src/bun/rpc/handlers.ts: a 500ms per-method throttle
// keyed by handler name, applied before the handler body runs.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { MusicSource } from "../../../../src/shared/types.ts";
import { createRpcHandlers } from "../../../../src/bun/rpc/handlers.ts";

const RATE_LIMIT_MS = 500;

// The test preload redirects the sqlite data directory to a throwaway folder.
let clock = 0;
const realNow = Date.now;

// The rate-limit map is module-level and survives between tests, so advance the
// fake clock far past the window in beforeEach instead of mutating internals.
beforeEach(() => {
  clock += 1_000_000;
  Date.now = () => clock;
});

afterAll(() => {
  Date.now = realNow;
});

function makeHandlers() {
  const calls: string[] = [];
  const player = {
    player: {
      isReady: true,
      next: async () => {
        calls.push("next");
      },
      insertNext: () => {
        calls.push("insertNext");
      },
      getQueue: () => {},
      recoveryToken: 0,
      pendingSeekToken: null,
      recoveryActive: false,
    },
    youtubeDataAPI: {},
    googleAuth: { init: async () => {}, authState: null, hasCredentials: false },
    status: null,
  };

  const handlers = createRpcHandlers({
    player: player as any,
    current: { time: 0, duration: 0, isLived: false, isPlaying: false },
    isLocal: true,
    isDiscord: false,
    DiscordClientId: "",
    discordRPC: { instance: null },
    emitToFrontend: () => {},
    emitError: () => {},
    play: () => {},
    setDiscordRPC: () => {},
  });

  return { handlers: handlers as any, calls };
}

const track = (id: string) => ({ id, name: `song-${id}`, source: MusicSource.Youtube });

describe("withRateLimit", () => {
  test("rejects the second call to the same handler inside the window", async () => {
    const { handlers } = makeHandlers();

    await handlers.playNext({ track: track("vid1") });

    expect(() => handlers.playNext({ track: track("vid2") })).toThrow(/Rate limited: playNext/);
  });

  test("allows the same handler again once the window has passed", async () => {
    const { handlers } = makeHandlers();

    await handlers.playNext({ track: track("vid1") });
    clock += RATE_LIMIT_MS;

    await handlers.playNext({ track: track("vid2") });
  });

  test("does not block other handlers while one is throttled", async () => {
    const { handlers, calls } = makeHandlers();

    await handlers.playNext({ track: track("vid1") });
    expect(() => handlers.playNext({ track: track("vid2") })).toThrow(/Rate limited/);

    await handlers.next();

    expect(calls).toContain("next");
  });
});
