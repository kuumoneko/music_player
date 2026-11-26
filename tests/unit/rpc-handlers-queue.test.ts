import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { MusicSource, MusicType } from "../../src/shared/types.ts";
import { getUserData, writeUserData } from "../../src/bun/db/index.ts";
import { createRpcHandlers } from "../../src/bun/rpc/handlers.ts";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// The test preload redirects the sqlite data directory to a throwaway folder,
// so this file never touches the real app database or the network.
const handlers = createRpcHandlers;

let clock = 0;
const realNow = Date.now;

beforeEach(() => {
  writeUserData("currentPlaying", null as any);
  writeUserData("playQueue", []);
  writeUserData("nextfrom", "");
  // Fixed per-test clock that jumps far ahead between tests, keeping the
  // module-level rate-limit map deterministic without disabling rate limits.
  clock += 1_000_000;
  Date.now = () => clock;
});

afterAll(() => {
  Date.now = realNow;
});

interface Harness {
  handlers: any;
  emitted: Array<{ event: string; payload: any }>;
  calls: string[];
  active: () => number;
  maxActive: () => number;
  player: any;
}

function makeHarness(options: { delayMs?: number } = {}): Harness {
  const delayMs = options.delayMs ?? 10;
  const emitted: Array<{ event: string; payload: any }> = [];
  const calls: string[] = [];
  let active = 0;
  let maxActive = 0;

  const enter = async (label: string) => {
    active++;
    maxActive = Math.max(maxActive, active);
    calls.push(`start:${label}`);
    await sleep(delayMs);
    calls.push(`end:${label}`);
    active--;
  };

  const player = {
    player: {
      isReady: true,
      next: async () => enter("next"),
      previous: async () => enter("previous"),
      togglePlayPause: async () => enter("togglePlayPause"),
      seekTo: () => {
        calls.push("seekTo");
      },
      setRepeat: () => {},
      insertNext: () => {
        calls.push("insertNext");
      },
      getQueue: () => {},
      recoveryToken: 0,
      pendingSeekToken: null,
      recoveryActive: false,
    },
    youtubeDataAPI: {
      fetchTrack: async (ids: string[]) => {
        await enter(`fetch:${ids[0]}`);
        return [{ id: ids[0], name: `song-${ids[0]}`, duration: 100, thumbnail: "t", artist: [{ name: "A", id: "1" }] }];
      },
      refetchTrack: async (id: string) => ({ id, name: `song-${id}`, duration: 100, thumbnail: "t", artist: [{ name: "A", id: "1" }] }),
    },
    googleAuth: { init: async () => {}, authState: null, hasCredentials: false },
    status: null,
  };

  const instance = handlers({
    player: player as any,
    current: { time: 0, duration: 0, isLived: false, isPlaying: false },
    isLocal: true,
    isDiscord: false,
    DiscordClientId: "",
    discordRPC: { instance: null },
    emitToFrontend: (event: string, payload: any) => emitted.push({ event, payload }),
    emitError: () => {},
    play: () => {
      calls.push("play");
    },
    setDiscordRPC: () => {},
  });

  return { handlers: instance, emitted, calls, active: () => active, maxActive: () => maxActive, player };
}

const youtubeItem = { id: "vid1", name: "Song", source: MusicSource.Youtube } as any;
const youtubeArgs = { item: youtubeItem, source: MusicSource.Youtube, type: MusicType.Track, id: "vid1" } as any;

describe("enqueuePlayerCommand serialization (1.4)", () => {
  test("all mutating commands run one after another without interleaving", async () => {
    const h = makeHarness({ delayMs: 8 });

    const promises = [
      h.handlers.next(),
      h.handlers.previous(),
      h.handlers.seekTo(12),
      h.handlers.togglePlayPause(),
      h.handlers.playNext({ track: { id: "vid2", name: "Next", source: MusicSource.Youtube } }),
      h.handlers.play(youtubeArgs),
    ];
    await Promise.all(promises);

    expect(h.maxActive()).toBe(1);
    const starts = h.calls.filter((entry) => entry.startsWith("start:"));
    expect(starts).toEqual([
      "start:next",
      "start:previous",
      "start:togglePlayPause",
      "start:fetch:vid1",
    ]);
    expect(h.calls).toContain("seekTo");
    expect(h.calls).toContain("insertNext");
    expect(h.calls).toContain("play");
  });

  test("a rate-limited command rejects without stalling the queue", async () => {
    const h = makeHarness({ delayMs: 5 });
    const track = { id: "vid3", name: "Third", source: MusicSource.Youtube };

    await h.handlers.playNext({ track });
    expect(() =>
      h.handlers.playNext({ track: { id: "vid4", name: "Fourth", source: MusicSource.Youtube } }),
    ).toThrow(/Rate limited/);

    await h.handlers.next();
    expect(h.calls).toContain("start:next");
    expect(h.calls).toContain("end:next");
  });

  test("read-only handlers are not blocked by the command queue", async () => {
    const h = makeHarness({ delayMs: 80 });
    writeUserData("volume", 42);
    writeUserData("currentPlaying", { id: "playing" } as any);

    const nextPromise = h.handlers.next();
    const readPromise = Promise.all([
      h.handlers.getPlayingData(),
      h.handlers.getUserData("volume"),
      // Local music lookups stay offline (no YouTube fetch).
      h.handlers.getMusicData({ source: MusicSource.Local, type: MusicType.Track, id: "local-1" }),
    ]);

    const winner = await Promise.race([
      nextPromise.then(() => "next"),
      readPromise.then(() => "read"),
    ]);
    expect(winner).toBe("read");

    await nextPromise;
  });
});

describe("playIntentSeq superseding guard (1.5)", () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  test("a newer play supersedes an older play awaiting the network", async () => {
    const h = makeHarness();
    const first = deferred<any[] | null>();

    let fetchCount = 0;
    h.player.youtubeDataAPI.fetchTrack = async (ids: string[]) => {
      fetchCount++;
      if (fetchCount === 1) return first.promise;
      return [{ id: ids[0], name: "newer", duration: 50, thumbnail: "t2", artist: [{ name: "B", id: "2" }] }];
    };

    const older = h.handlers.play(youtubeArgs);
    await sleep(5);

    const newer = h.handlers.play({
      item: { id: "vid9", name: "Newer", source: MusicSource.Youtube },
      source: MusicSource.Youtube,
      type: MusicType.Track,
      id: "vid9",
    });

    first.resolve([{ id: "vid1", name: "older", duration: 50, thumbnail: "t1", artist: [{ name: "A", id: "1" }] }]);

    await expect(older).resolves.toBeNull();
    await newer;

    expect(getUserData("currentPlaying")?.id).toBe("vid9");
    const trackEvents = h.emitted.filter((entry) => entry.event === "currentTrackChanged");
    expect(trackEvents).toHaveLength(1);
    expect(trackEvents[0].payload.id).toBe("vid9");
    const queueEvents = h.emitted.filter((entry) => entry.event === "queueChanged");
    expect(queueEvents).toHaveLength(1);
  });

  for (const command of ["next", "previous"] as const) {
    test(`a newer ${command} supersedes an older play awaiting the network`, async () => {
      const h = makeHarness();
      const first = deferred<any[] | null>();
      h.player.youtubeDataAPI.fetchTrack = async () => first.promise;

      const older = h.handlers.play(youtubeArgs);
      await sleep(5);
      const newer = h.handlers[command]();

      first.resolve([{ id: "vid1", name: "older", duration: 50, thumbnail: "t1", artist: [{ name: "A", id: "1" }] }]);

      await expect(older).resolves.toBeNull();
      await newer;

      expect(getUserData("currentPlaying") ?? null).toBeNull();
      expect(h.emitted.some((entry) => entry.event === "currentTrackChanged")).toBe(false);
      expect(h.emitted.some((entry) => entry.event === "queueChanged")).toBe(false);
    });
  }

  test("a newer playNext supersedes an older play awaiting the network", async () => {
    const h = makeHarness();
    const first = deferred<any[] | null>();
    h.player.youtubeDataAPI.fetchTrack = async () => first.promise;

    const older = h.handlers.play(youtubeArgs);
    await sleep(5);
    const newer = h.handlers.playNext({ track: { id: "vid5", name: "Five", source: MusicSource.Youtube } });

    first.resolve([{ id: "vid1", name: "older", duration: 50, thumbnail: "t1", artist: [{ name: "A", id: "1" }] }]);

    await expect(older).resolves.toBeNull();
    await newer;

    expect(getUserData("currentPlaying") ?? null).toBeNull();
    expect(h.emitted.some((entry) => entry.event === "currentTrackChanged")).toBe(false);
  });
});
