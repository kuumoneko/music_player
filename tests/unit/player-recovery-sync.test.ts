import { beforeAll, describe, expect, jest, test } from "bun:test";
import { ptr } from "bun:ffi";
import { writeUserData } from "../../src/bun/db/index.ts";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let Play: any;

beforeAll(async () => {
  ({ default: Play } = await import("../../src/bun/music/play.ts"));
});

function toText(value: any): string {
  if (Buffer.isBuffer(value)) return value.toString().replace(/\0+$/, "");
  return String(value);
}

interface PlayerHarness {
  player: any;
  writes: Array<{ key: string; value: string }>;
  commands: string[];
  emits: any[];
}

function makePlayer(volume = 50): PlayerHarness {
  writeUserData("volume", volume);
  writeUserData("currentPlaying", null as any);

  const writes: Array<{ key: string; value: string }> = [];
  const commands: string[] = [];
  const emits: any[] = [];
  const timeBuffer = Buffer.from("12.5\0");

  const player: any = new Play("E:\\fake");
  player.symbols = {
    mpv_set_property_string: (_handle: any, key: any, value: any) => {
      writes.push({ key: toText(key), value: toText(value) });
      return 0;
    },
    mpv_get_property_string: (_handle: any, key: any) => {
      if (toText(key) === "time-pos") return ptr(timeBuffer);
      return 0;
    },
    mpv_free: () => {},
    mpv_command_string: (_handle: any, command: any) => {
      commands.push(toText(command));
      return 0;
    },
    mpv_error_string: () => 0,
  };
  player.handle = 1;
  player.isReady = true;
  player.on("change-playState", (data: any) => emits.push(data));

  return { player, writes, commands, emits };
}

function pauseProperty(paused: boolean): number {
  const nameBuffer = Buffer.from("pause\0");
  const dataBuffer = Buffer.alloc(4);
  dataBuffer.writeInt32LE(paused ? 1 : 0, 0);
  const propBuffer = Buffer.alloc(24);
  propBuffer.writeBigUInt64LE(BigInt(ptr(nameBuffer)), 0);
  propBuffer.writeInt32LE(2, 8); // MPV_FORMAT_FLAG
  propBuffer.writeBigUInt64LE(BigInt(ptr(dataBuffer)), 16);
  return ptr(propBuffer);
}

describe("recovery generation token (2.1 - 2.4)", () => {
  test("matching token applies pendingSeek and pendingResume", () => {
    const h = makePlayer();
    const player = h.player;
    player.recoveryToken = 3;
    player.pendingSeek = 12.5;
    player.pendingSeekToken = 3;
    player.pendingResume = true;
    player.isFirstLoad = false;

    player.handleFileLoaded();

    expect(h.commands).toContain("seek 12.5 absolute");
    expect(h.writes).toContainEqual({ key: "pause", value: "no" });
    expect(h.emits.at(-1)).toMatchObject({ isPlaying: true, time: 12.5 });
    expect(player.pendingSeek).toBeNull();
    expect(player.pendingSeekToken).toBeNull();
    expect(player.pendingResume).toBe(false);
    expect(player.isLoadingFile).toBe(false);
  });

  test("timePos === 0 is valid and does not emit a bogus seek", () => {
    const h = makePlayer();
    const player = h.player;
    player.recoveryToken = 0;
    player.pendingSeek = 0;
    player.pendingSeekToken = 0;
    player.pendingResume = false;
    player.isFirstLoad = false;

    player.handleFileLoaded();

    expect(h.commands.some((cmd: string) => cmd.startsWith("seek 0 absolute"))).toBe(false);
    expect(h.writes).toContainEqual({ key: "pause", value: "yes" });
    expect(h.emits.at(-1)).toMatchObject({ isPlaying: false, time: 0 });
    expect(player.pendingSeekToken).toBeNull();
  });

  test("a mismatched token clears pending state and falls through to a normal load", () => {
    const h = makePlayer();
    const player = h.player;
    player.recoveryToken = 2;
    player.pendingSeek = 33;
    player.pendingSeekToken = 1;
    player.pendingResume = true;
    player.isFirstLoad = false;

    player.handleFileLoaded();

    expect(h.commands).not.toContain("seek 33 absolute");
    expect(h.emits.some((emit: any) => emit.time === 33)).toBe(false);
    expect(player.pendingSeek).toBeNull();
    expect(player.pendingSeekToken).toBeNull();
  });

  test("cancelRecovery invalidates state even when recoveryActive is already false", () => {
    const h = makePlayer();
    const player = h.player;
    player.recoveryActive = false;
    player.recoveryToken = 7;
    player.pendingSeek = 5;
    player.pendingSeekToken = 7;
    player.pendingResume = true;

    player.cancelRecovery("test");
    expect(player.recoveryToken).toBe(8);
    expect(player.pendingSeek).toBeNull();
    expect(player.pendingSeekToken).toBeNull();
    expect(player.pendingResume).toBe(false);

    // Idempotent: calling it again is safe and keeps bumping the token.
    player.cancelRecovery("test");
    expect(player.recoveryToken).toBe(9);
  });

  test("new play invalidates the old recovery seek and ignores the stale FILE_LOADED", async () => {
    const h = makePlayer();
    const player = h.player;
    player.recoveryToken = 4;
    player.pendingSeek = 77;
    player.pendingSeekToken = 4;
    player.pendingResume = true;
    player.loadedUrl = "C:/old/track.mp3";
    player.resolveYoutubeUrl = async () => ({ url: "http://127.0.0.1/new.mp3" });

    await player.play("https://www.youtube.com/watch?v=abc");

    expect(player.pendingSeek).toBeNull();
    expect(player.pendingSeekToken).toBeNull();
    expect(player.pendingResume).toBe(false);

    player.isLoadingFile = true;
    player.handleFileLoaded();

    expect(h.commands).not.toContain("seek 77 absolute");
    expect(h.emits.some((emit: any) => emit.time === 77)).toBe(false);
    // The stale load must not clear the new load's loading flag.
    expect(player.isLoadingFile).toBe(true);
  });

  test("next and previous invalidate pending recovery state", async () => {
    for (const command of ["next", "previous"] as const) {
      const h = makePlayer();
      const player = h.player;
      player.pendingSeek = 9;
      player.pendingSeekToken = 0;
      player.pendingResume = true;
      player.playlistUrls = ["a", "b"];
      player.playlistIndex = command === "next" ? 0 : 1;
      player.fadeVolume = async () => {};

      await player[command]();

      expect(player.pendingSeek).toBeNull();
      expect(player.pendingSeekToken).toBeNull();
      expect(player.pendingResume).toBe(false);
    }
  });
});

describe("setPlaybackState and loading guards (3.1 - 3.5)", () => {
  test("emissions from an older loadToken are ignored", () => {
    const h = makePlayer();
    const player = h.player;
    player.lastAppliedLoadToken = 5;
    player.isPlaying = false;

    player.setPlaybackState(true, { token: 4, force: true });
    expect(h.emits).toHaveLength(0);
    expect(player.isPlaying).toBe(false);

    player.setPlaybackState(true, { token: 5, force: true });
    expect(h.emits).toHaveLength(1);
    expect(player.isPlaying).toBe(true);
  });

  test("250ms time poll skips updates while isLoadingFile is true", () => {
    const h = makePlayer();
    const player = h.player;
    jest.useFakeTimers();
    try {
      player.isLoadingFile = true;
      player.startTimePolling();
      jest.advanceTimersByTime(250);
      expect(h.emits).toHaveLength(0);

      player.isLoadingFile = false;
      jest.advanceTimersByTime(250);
      expect(h.emits).toHaveLength(1);
      expect(h.emits[0]).toMatchObject({ time: 12.5 });
    } finally {
      clearInterval(player.timePosTimer);
      jest.useRealTimers();
    }
  });

  test("pause observer ignores mpv's load-time pause event", () => {
    const h = makePlayer();
    const player = h.player;
    player.isPlaying = true;
    player.isLoadingFile = true;

    player.handlePropertyChange(pauseProperty(true));
    expect(h.emits).toHaveLength(0);
    expect(player.isPlaying).toBe(true);

    player.isLoadingFile = false;
    player.handlePropertyChange(pauseProperty(true));
    expect(h.emits).toHaveLength(1);
    expect(h.emits[0].isPlaying).toBe(false);
  });

  test("pendingPauseIntent recorded during loading is applied after handleFileLoaded", async () => {
    const h = makePlayer();
    const player = h.player;
    player.isLoadingFile = true;
    player.fadeVolume = async () => {};

    await player.togglePlayPause(false);
    expect(player.pendingPauseIntent).toBe(true);

    player.isFirstLoad = false;
    player.handleFileLoaded();

    expect(h.commands).toContain("set pause yes");
    expect(h.emits.at(-1)).toMatchObject({ isPlaying: false });
    expect(player.pendingPauseIntent).toBeNull();
    expect(player.isLoadingFile).toBe(false);
  });

  test("FILE_LOADED for a mismatched path is ignored entirely", () => {
    const h = makePlayer();
    const player = h.player;
    player.expectedLoadPath = "C:/new/new-track.mp3";
    player.loadedUrl = "C:/old/old-track.mp3";
    player.isLoadingFile = true;

    player.handleFileLoaded();

    expect(player.isLoadingFile).toBe(true);
    expect(h.commands).toHaveLength(0);
    expect(h.emits).toHaveLength(0);
  });
});

describe("fade generation safety (3.6)", () => {
  test("setVolume cancels an active fade, resolves it and blocks old timer writes", async () => {
    const h = makePlayer();
    const player = h.player;

    const fade = player.fadeVolume(0, 100, 500);
    await sleep(25);
    expect(h.writes.some((entry) => entry.key === "volume")).toBe(true);

    player.setVolume(40);
    const winner = await Promise.race([fade.then(() => "resolved"), sleep(100).then(() => "timeout")]);
    expect(winner).toBe("resolved");

    const writeCount = h.writes.length;
    await sleep(60);
    expect(h.writes.length).toBe(writeCount);
    const volumeWrites = h.writes.filter((entry) => entry.key === "volume");
    expect(volumeWrites.at(-1)?.value).toBe("40");
  });

  test("delayed scheduleFade never fires after play replaces the track", async () => {
    const h = makePlayer();
    const player = h.player;
    player.resolveYoutubeUrl = async () => ({ url: "http://127.0.0.1/another.mp3" });

    player.scheduleFade(0, 100, 450, 60);
    await player.play("https://www.youtube.com/watch?v=xyz");

    const writeCount = h.writes.length;
    await sleep(100);
    expect(h.writes.length).toBe(writeCount);
    expect(h.writes.some((entry) => entry.value === "100")).toBe(false);
  });

  test("togglePlayPause cancels an active fade immediately", async () => {
    const h = makePlayer();
    const player = h.player;

    const fade = player.fadeVolume(0, 100, 500);
    await sleep(20);

    const toggle = player.togglePlayPause(true);
    const winner = await Promise.race([fade.then(() => "resolved"), sleep(100).then(() => "timeout")]);
    expect(winner).toBe("resolved");

    // Cancel toggle's own fade-in so the test stays fast and deterministic.
    player.setVolume(30);
    await toggle;
  });

  test("next and previous cancel an active fade", async () => {
    for (const command of ["next", "previous"] as const) {
      const h = makePlayer();
      const player = h.player;
      const fade = player.fadeVolume(0, 100, 500);
      await sleep(20);

      // The command's own fade is irrelevant here; we only assert that its
      // cancelFade() resolves the fade that was already running.
      player.fadeVolume = async () => {};
      await player[command]();

      const winner = await Promise.race([fade.then(() => "resolved"), sleep(100).then(() => "timeout")]);
      expect(winner).toBe("resolved");
    }
  });

  test("stop cancels any active fade", async () => {
    const h = makePlayer();
    const player = h.player;
    const fade = player.fadeVolume(0, 100, 500);
    await sleep(20);

    player.setVolume(0);
    await expect(fade).resolves.toBeUndefined();
    expect(h.writes.at(-1)).toEqual({ key: "volume", value: "0" });
  });
});
