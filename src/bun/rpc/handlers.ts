import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import type DiscordRPC from "../discord/index.ts";
import type Player from "../music/index.ts";
import DownloadController from "../controllers/download.ts";
import HomeController, { HomeFeedController, clearHomeCaches, getHomeArtists, getHomePlaylists, getHomeTracks, getHomeNewTracks } from "../controllers/home.ts";
import MusicController from "../controllers/music.ts";
import formatArtists from "../../shared/utils/formatArtist.ts";
import { SleepMode, Repeat, Track } from "../../shared/types.ts";
import { MusicSource, MusicType, UserData } from "../../shared/types.ts";
import {
  getAllLocalFiles,
  getLocalFileById,
  getSystemData,
  getUserData,
  getUserDatas,
  writeLogs,
  writeSystemData,
  writeUserData,
  writeUserDatas,
  createPlaylist,
  deletePlaylist as deletePlaylistDb,
  getAllPlaylists,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  getPlaylist,
  getArtistById,
  getArtistByPlaylistId,
} from "../db/index.ts";
import { getHash, resolveId, tracksToFront } from "../lib/hash.ts";
import { isValidContextEntry } from "../lib/nextfrom.ts";
import db from "../db/setup.ts";
import { decryptCredential, isEncrypted } from "../lib/crypto.ts";
import SearchController from "../controllers/search.ts";

export interface RpcContext {
  player: Player;
  current: { time: number; duration: number; isLived: boolean; isPlaying: boolean };
  isLocal: boolean;
  isDiscord: boolean;
  DiscordClientId: string;
  discordRPC: { instance: DiscordRPC | null };
  emitToFrontend: (message: string, payload: any) => void;
  emitError: (error: unknown) => void;
  play: () => void;
  setDiscordRPC: () => void;
}

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 500;

const imageCache = new Map<string, { data: string; at: number }>();
const IMAGE_TTL_MS = 30 * 60_000;
const IMAGE_CACHE_MAX = 200;

function purgeImageCache() {
  imageCache.clear();
}

let downloadInFlight = false;

function withRateLimit<T extends (...args: any[]) => any>(fn: T, name: string): T {
  return ((...args: any[]) => {
    const now = Date.now();
    const last = rateLimitMap.get(name) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      throw new Error(`Rate limited: ${name}`);
    }
    rateLimitMap.set(name, now);
    return fn(...args);
  }) as T;
}

function withErrorLog<T, A extends unknown[]>(
  label: string,
  fn: (...args: A) => Promise<T>,
  emitError?: (message: string) => void,
): (...args: A) => Promise<T | null> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      writeLogs([{ type: "error", message: `${label}: ${message}` }]);
      emitError?.(`${label}: ${message}`);
      return null;
    }
  };
}

export function createRpcHandlers(ctx: RpcContext) {
  const { player, current, isLocal, isDiscord, DiscordClientId, emitToFrontend, play, setDiscordRPC } = ctx;

  const withErrorLogEmit = <T, A extends unknown[]>(label: string, fn: (...args: A) => Promise<T>) => {
    return withErrorLog(label, fn, (message: string) => {
      emitToFrontend("error", { message });
    });
  };

  return {
    getMusicData: withRateLimit(
      withErrorLogEmit("getMusicData", async ({ source, type, id }: { source: MusicSource; type: MusicType; id: string }) =>
        MusicController(player, source, type, id),
      ),
      "getMusicData",
    ),
    getQueueData: async (items: string[]) => {
      if (!items || items.length === 0) return [];
      const results = await Promise.all(items.map(async (entry) => {
        const parts = entry.split(":");
        const source = parts[0] as MusicSource;
        const type = (parts[1] || MusicType.Track) as MusicType;
        const id = parts[2] || parts[1] || "";
        try {
          return await MusicController(player, source, type, id);
        } catch {
          return null;
        }
      }));
      return results;
    },

    getLocalfile: withErrorLogEmit("getLocalfile", async () => tracksToFront(getAllLocalFiles())),

    searchMusic: withErrorLogEmit("searchMusic", async ({ type, query, source }: { type: MusicType; query: string; source: MusicSource }) =>
      SearchController(player, source, type, query),
    ),

    getHomeData: withRateLimit(
      withErrorLogEmit("getHomeData", async () => {
        const pin = getUserData("pin");
        return HomeController(player, pin);
      }),
      "getHomeData",
    ),

    getHomeFeed: withRateLimit(
      withErrorLogEmit("getHomeFeed", async () => {
        const pin = getUserData("pin");
        return HomeFeedController(player, pin);
      }),
      "getHomeFeed",
    ),

    getHomeArtists: withRateLimit(
      withErrorLogEmit("getHomeArtists", async () => {
        const pin = getUserData("pin") ?? [];
        return getHomeArtists(player, pin);
      }),
      "getHomeArtists",
    ),

    getHomePlaylists: withRateLimit(
      withErrorLogEmit("getHomePlaylists", async () => {
        const pin = getUserData("pin") ?? [];
        return getHomePlaylists(player, pin);
      }),
      "getHomePlaylists",
    ),

    getHomeTracks: withRateLimit(
      withErrorLogEmit("getHomeTracks", async () => {
        const pin = getUserData("pin") ?? [];
        return getHomeTracks(player, pin);
      }),
      "getHomeTracks",
    ),

    getHomeNewTracks: withRateLimit(
      withErrorLogEmit("getHomeNewTracks", async () => {
        const pin = getUserData("pin") ?? [];
        return getHomeNewTracks(player, pin);
      }),
      "getHomeNewTracks",
    ),

    getIsLocal: () => {
      return isLocal;
    },

    downloadMusic: withRateLimit(
      withErrorLogEmit("downloadMusic", async () => {
        if (downloadInFlight) {
          throw new Error("Download already in progress");
        }
        const downloadQueue = getUserData("downloadQueue") ?? [];
        if (downloadQueue.length === 0) {
          throw new Error("No download queue");
        }
        if (!isLocal) {
          throw new Error("User dont set this app has local file");
        }
        downloadInFlight = true;
        try {
          return await DownloadController(player);
        } finally {
          downloadInFlight = false;
        }
      }),
      "downloadMusic",
    ),

    getDownloadStatus: async () => {
      return !isLocal ? null : player.status;
    },

    close: async () => {
      return null;
    },

    minimize: async () => {
      return null;
    },

    toggleQuitOnClose: async () => {
      writeUserData("QuitOnClose", !getUserData("QuitOnClose"));
    },

    isQuitOnClose: async () => {
      return getUserData("QuitOnClose");
    },

    togglePlayPause: async () => {
      if (!player.player?.isReady) return;
      try {
        await player.player.togglePlayPause(!current.isPlaying);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `togglePlayPause failed: ${message}` }]);
      }
    },

    getUserData: async (key: keyof UserData) => {
      if (key === "folder" && !isLocal) {
        return null;
      }
      return getUserData(key);
    },

    setUserData: async ({ key, data }: { key: keyof UserData; data: any }) => {
      try {
        if (key === "folder" && !isLocal) {
          return null;
        }
        if (key === "folder") {
          const value = data;

          if (!value) {
            return { ok: false, data: "No folder selected" };
          }
          const canonicalPath = resolve(value);
          try {
            const stats = await stat(canonicalPath);
            if (!stats.isDirectory()) {
              return { ok: false, data: "Selected path is not a directory" };
            }
          } catch {
            return { ok: false, data: "Selected folder does not exist" };
          }

          writeUserData("folder", canonicalPath);
          player.local?.scanFolder(canonicalPath).then(() => {
            emitToFrontend("local-files-changed", null);
          });
          return canonicalPath;
        }

        writeUserData(key, data);

        if (key === "pin" && Array.isArray(data)) {
          // Re-pinning an item clears its broken marker so it is retried immediately.
          const broken = getUserData("brokenPins") ?? {};
          let changed = false;
          for (const p of data) {
            if (p in broken) {
              delete broken[p];
              changed = true;
            }
          }
          if (changed) writeUserData("brokenPins", broken);
        }

        if (key === "volume") {
          player.player?.setVolume(data);
          emitToFrontend("settingsChanged", {
            shuffle: getUserData("shuffle"),
            repeat: getUserData("repeat"),
            volume: data,
          });
        }
        if (key === "repeat") {
          player.player?.setRepeat(data === Repeat.One);
          emitToFrontend("settingsChanged", {
            shuffle: getUserData("shuffle"),
            repeat: data,
            volume: getUserData("volume"),
          });
        }
        if (key === "shuffle") {
          emitToFrontend("settingsChanged", {
            shuffle: data,
            repeat: getUserData("repeat"),
            volume: getUserData("volume"),
          });
        }
        if (key === "equalizerBands") {
          const enabled = getUserData("equalizerEnabled") ?? true;
          player.player?.setEqualizer(enabled ? data : []);
        }
        if (key === "equalizerEnabled") {
          const bands = getUserData("equalizerBands") ?? [];
          player.player?.setEqualizer(data ? bands : []);
        }
        if (key === "playQueue" || key === "batchQueue" || key === "nextfrom") {
          player.player?.getQueue();
          emitToFrontend("queueChanged", {
            playQueue: getUserData("playQueue"),
            batchQueue: getUserData("batchQueue"),
            nextfrom: getUserData("nextfrom"),
            playedTrack: getUserData("playedTrack"),
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when writing user data with\nKey = ${key}\nValue = ${data}\n${message}` }]);
        return null;
      }
    },

    getPlayingData: async () => {
      const result = getUserDatas(["shuffle", "repeat", "isLoading", "playedTrack", "current"]);
      return {
        ...result,
        current,
        isPlaying: current.isPlaying,
      };
    },

    next: withErrorLogEmit("next", async () => { player.player?.next(); }),

    previous: withErrorLogEmit("previous", async () => { player.player?.previous(); }),

    play: async ({ item, source, type, id }: { item: Track; source: MusicSource; type: string; id: string }) => {
writeLogs([{
        type: "info",
        message: JSON.stringify({ item, source, type, id })
      }]);
      const user = getUserDatas(["playQueue", "currentPlaying", "shuffle", "repeat", "playedTrack", "nextfrom"]) as UserData;
      user.playQueue = [];
      player.player?.setRepeat(false);

      const trackSource = item?.source ?? source;

      if (trackSource === MusicSource.Youtube) {
        let tracks = await player.youtubeDataAPI.fetchTrack([item.id]);

        let track = tracks?.[0];
        if (!track) {
          // Track deleted/private — clean pin + notify frontend
          const pin = getUserData("pin") ?? [];
          const key = `${source}:${MusicType.Track}:${item.id}`;
          if (pin.includes(key)) {
            writeUserData("pin", pin.filter((p: string) => p !== key));
          }
          emitToFrontend("trackUnavailable", { id: item.id, name: item.name });
          return null;
        }

        if (!formatArtists(track.artist)) {
          const refetched = await player.youtubeDataAPI.refetchTrack(item.id);
          if (refetched) {
            track = refetched;
          }
        }

        user.currentPlaying = {
          source: trackSource,
          id: item.id,
          title: track.name,
          thumbnail: track.thumbnail,
          artist: formatArtists(track.artist),
          artistId: track.artist?.[0]?.id ?? "",
        };
        current.duration = track.duration;
      } else if (trackSource === MusicSource.Local) {
        const track = getLocalFileById(resolveId(item.id));
        if (!track) return null;
        user.currentPlaying = {
          source: MusicSource.Local,
          id: getHash(track.id),
          title: track.name ?? "",
          thumbnail: track.thumbnail ?? "",
          artist: formatArtists(track.artist ?? [{ name: "", id: "" }]),
          artistId: track.artist?.[0]?.id ?? "",
        };
        current.duration = track.duration ?? 0;
        current.isLived = false;
      }

      user.nextfrom = isValidContextEntry(`${source}:${type}:${id}`) ? `${source}:${type}:${id}` : "";
      writeLogs([{
        type: "info",
        message: `play: nextfrom="${user.nextfrom}" (input "${source}:${type}:${id}", item id="${item?.id}")`
      }]);

      current.time = 0;
      user.repeat = user.repeat === Repeat.Disable ? Repeat.Disable : Repeat.All;

      user.playedTrack = Array.from(new Set([...user.playedTrack, user.currentPlaying.id]));
      writeUserDatas(user);
      emitToFrontend("currentTrackChanged", {
        source: user.currentPlaying.source,
        id: user.currentPlaying.id,
        title: user.currentPlaying.title,
        thumbnail: user.currentPlaying.thumbnail,
        artist: user.currentPlaying.artist,
        artistId: user.currentPlaying.artistId,
      });
      emitToFrontend("queueChanged", {
        playQueue: user.playQueue,
        batchQueue: getUserData("batchQueue"),
        nextfrom: user.nextfrom,
        playedTrack: user.playedTrack,
      });
      emitToFrontend("settingsChanged", {
        shuffle: user.shuffle,
        repeat: user.repeat,
        volume: getUserData("volume"),
      });
      play();
      return user.currentPlaying;
    },

    seekTo: withErrorLogEmit("seekTo", async (time: number) => {
      current.time = time;
      player.player?.seekTo(time);
      emitToFrontend("timeUpdate", { time: current.time, isPlaying: current.isPlaying });
    }),

    getCurrentPlaying: async () => {
      return getUserData("currentPlaying") ?? null;
    },

    setSleep: withErrorLogEmit("setSleep", async (mode: SleepMode) => { player.player?.setSleep(mode); }),

    checkUpdate: async () => {
      return null;
    },

    update: async () => {
      return null;
    },

    isHasDiscordRPC: async () => {
      if (isDiscord) {
        return ctx.discordRPC.instance?.username ?? false;
      }
      return null;
    },

    connectDiscordRPC: async () => {
      try {
        if (isDiscord) {
          const DiscordModule = await import("../discord/index.ts");
          ctx.discordRPC.instance?.disconnect();
          ctx.discordRPC.instance = new DiscordModule.default(String(DiscordClientId));
          ctx.discordRPC.instance.onReady = () => setDiscordRPC();
          const ok = await ctx.discordRPC.instance.connectWithRetry();
          if (ok) {
            return ctx.discordRPC.instance?.username ?? false;
          }
          emitToFrontend("showMessage", {
            title: "Discord Client is not running",
            message: "Please open Discord Client then Connect again.",
          });
          return false;
        } else {
          emitToFrontend("showMessage", {
            title: "Discord RPC is not installed",
            message: "Please reinstall and set isDiscord is true.",
          });
          return null;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when connecting with Discord\n${message}` }]);
        emitToFrontend("error", { message: `Discord error: ${message}` });
        return null;
      }
    },

    disconnectDiscordRPC: async () => {
      ctx.discordRPC.instance?.disconnect();
      ctx.discordRPC.instance = null;
    },

    sendError: (error: Error) => {
      const message = error.message || error.name || "Unknown error";
      writeLogs([
        { type: "error", message: error.name ?? "" },
        { type: "error", message: error.message ?? "" },
        { type: "error", message: error.stack ?? "" },
      ]);
      emitToFrontend("error", { message });
    },

    writeLog: ({ type, source, message }: { type: "info" | "error"; source?: string; message: string }) => {
      writeLogs([{ type: type === "error" ? "error" : "info", source: source ?? "app", message: String(message ?? "") }]);
    },

    setUiVisibility: async (visible: boolean) => {
      if (!visible) {
        purgeImageCache();
        clearHomeCaches();
        try {
          db.run("PRAGMA shrink_memory;");
        } catch {
          // non-fatal
        }
        Bun.gc(false);
      }
      return true;
    },

    openDevTools: () => {
      return null;
    },

    getImageDataUri: withErrorLogEmit("getImageDataUri", async (url: string) => {
      const cached = imageCache.get(url);
      if (cached && Date.now() - cached.at < IMAGE_TTL_MS) {
        return cached.data;
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        throw new Error(`getImageDataUri: fetch failed with status ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);

      let ext = "jpeg";
      if (bytes[0] === 0x89 && bytes[1] === 0x50) ext = "png";
      else if (bytes[0] === 0x47 && bytes[1] === 0x49) ext = "gif";
      else if (bytes[0] === 0x52 && bytes[1] === 0x49) ext = "webp";

      const b64 = Buffer.from(bytes).toString("base64");
      const data = `data:image/${ext};base64,${b64}`;
      if (imageCache.size >= IMAGE_CACHE_MAX) {
        let oldestKey: string | undefined;
        let oldestAt = Infinity;
        for (const [key, entry] of imageCache) {
          if (entry.at < oldestAt) {
            oldestAt = entry.at;
            oldestKey = key;
          }
        }
        if (oldestKey !== undefined) imageCache.delete(oldestKey);
      }
      imageCache.set(url, { data, at: Date.now() });
      return data;
    }),

    resolveThumbnailUrl: withErrorLogEmit("resolveThumbnailUrl", async ({ id, type }: { id: string, type: MusicType }) => {
      if (type === MusicType.Track) {
        return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
      }
      if (type === MusicType.Playlist) {
        const playlist = getPlaylist(id, false);
        if (playlist?.thumbnail) return playlist.thumbnail;
        if (id.startsWith("UU")) {
          const artist = getArtistByPlaylistId(id);
          if (artist?.thumbnail) return artist.thumbnail;
        }
        return null;
      }
      if (type === MusicType.Artist) {
        const artist = getArtistById(id, false);
        return artist?.thumbnail ?? null;
      }
      return null;
    }),

    createPlaylist: withErrorLogEmit("createPlaylist", async ({ name }: { name: string }) => {
      const playlist = createPlaylist(name);
      const pin = getUserData("pin") ?? [];
      const key = `local:playlist:${playlist.id}`;
      if (!pin.includes(key)) {
        pin.push(key);
        writeUserData("pin", pin);
      }
      return playlist;
    }),

    deletePlaylist: withErrorLogEmit("deletePlaylist", async ({ id }: { id: string }) => {
      const pin = getUserData("pin") ?? [];
      const newPin = pin.filter((item: string) => item !== `local:playlist:${id}`);
      writeUserData("pin", newPin);
      deletePlaylistDb(id);
    }),

    getUserPlaylists: withErrorLogEmit("getUserPlaylists", async () => {
      return getAllPlaylists();
    }),

    addToPlaylist: withErrorLogEmit("addToPlaylist", async ({ playlistId, track }: { playlistId: string; track: Track }) => {
      addTrackToPlaylist(playlistId, track);
    }),

    removeFromPlaylist: withErrorLogEmit("removeFromPlaylist", async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      removeTrackFromPlaylist(playlistId, trackId);
    }),

    getYoutubeApiKeys: async () => {
      const storedKeys = getSystemData().youtubeApiKeys ?? [];
      const plainKeys: string[] = [];
      for (const k of storedKeys) {
        plainKeys.push(isEncrypted(k) ? ((await decryptCredential(k)) ?? k) : k);
      }
      return plainKeys;
    },

    addYoutubeApiKey: async ({ key }: { key: string }) => {
      const keys = getSystemData().youtubeApiKeys ?? [];
      const trimmed = key.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
        writeSystemData({ youtubeApiKeys: keys });
        player.youtubeDataAPI.updateApiKeys(keys);
      }
      return keys;
    },

    removeYoutubeApiKey: async ({ key }: { key: string }) => {
      const keys = getSystemData().youtubeApiKeys ?? [];
      const updated = keys.filter((k: string) => k !== key);
      writeSystemData({ youtubeApiKeys: updated });
      player.youtubeDataAPI.updateApiKeys(updated);
      return updated;
    },

    importYoutubeApiKeys: async ({ keys }: { keys: string[] }) => {
      const existing = getSystemData().youtubeApiKeys ?? [];
      const trimmed = keys.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
      const merged = [...new Set([...existing, ...trimmed])];
      writeSystemData({ youtubeApiKeys: merged });
      player.youtubeDataAPI.updateApiKeys(merged);
      return merged;
    },

    getYtCookies: async () => {
      return getUserData("ytCookies") ?? "";
    },

    setYtCookies: withErrorLogEmit("setYtCookies", async ({ cookies }: { cookies: string }) => {
      const trimmed = cookies.trim();
      writeUserData("ytCookies", trimmed);
      writeLogs([{ type: "info", message: "YouTube cookies updated" }]);
      return trimmed;
    }),

    clearYtCookies: async () => {
      writeUserData("ytCookies", "");
      writeLogs([{ type: "info", message: "YouTube cookies cleared" }]);
      return "";
    },

    addToBatchQueue: async ({ source, type, id }: { source: MusicSource; type: MusicType; id: string }) => {
      const entry = `${source}:${type}:${id}`;
      if (!isValidContextEntry(entry)) {
        writeLogs([{ type: "error", message: `addToBatchQueue: invalid entry "${entry}"` }]);
        return null;
      }
      const batchQueue = getUserData("batchQueue") as string[];
      if (!batchQueue.includes(entry)) {
        batchQueue.push(entry);
        writeUserData("batchQueue", batchQueue);
        emitToFrontend("queueChanged", {
          playQueue: getUserData("playQueue"),
          batchQueue,
          nextfrom: getUserData("nextfrom"),
          playedTrack: getUserData("playedTrack"),
        });
      }
    },

    refreshPlaylist: withErrorLogEmit("refreshPlaylist", async ({ id }: { id: string }) => {
      const playlist = await player.youtubeDataAPI.fetchPlaylist(id, false, true);
      emitToFrontend("refetch", null);
      return playlist ?? null;
    }),

    refreshArtist: withErrorLogEmit("refreshArtist", async ({ id }: { id: string }) => {
      const artist = await player.youtubeDataAPI.fetchArtist(id, false, true);
      emitToFrontend("refetch", null);
      return artist ?? null;
    }),

    getGoogleAuthStatus: withErrorLogEmit("getGoogleAuthStatus", async () => {
      await player.googleAuth.init();
      return player.googleAuth.authState;
    }),

    saveGoogleCredentials: withErrorLogEmit("saveGoogleCredentials", async ({ clientId, clientSecret }: { clientId: string, clientSecret?: string }) => {
      player.googleAuth.saveCredentials(clientId, clientSecret ?? "");
      writeLogs([{ type: "info", message: "Google OAuth credentials saved" }]);
    }),

    clearGoogleCredentials: withErrorLogEmit("clearGoogleCredentials", async () => {
      player.googleAuth.clearCredentials();
      writeLogs([{ type: "info", message: "Google OAuth credentials cleared" }]);
    }),

    signInWithGoogle: withErrorLogEmit("signInWithGoogle", async () => {
      if (!player.googleAuth.hasCredentials) {
        return { success: false };
      }
      const servers: ReturnType<typeof Bun.serve>[] = [];
      let callbackPort = 0;
      const emitAuthState = (ok: boolean) => {
        const state = player.googleAuth.authState;
        emitToFrontend("googleAuthState", {
          isSignedIn: ok,
          email: ok ? state.email : null,
          expiresAt: ok ? state.expiresAt : null,
        });
      };
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const closeServers = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
        servers.forEach((s) => s.stop());
      };
      const handleCallback = async (req: Request) => {
        const url = new URL(req.url);
        if (url.pathname === "/" || url.pathname === "/oauth/callback") {
          const code = url.searchParams.get("code");
          const error = url.searchParams.get("error");
          if (error || !code) {
            closeServers();
            emitAuthState(false);
            return new Response(`OAuth error: ${error ?? "missing code"}`, { status: 400 });
          }
          const ok = await player.googleAuth.exchangeCode(code, callbackPort);
          closeServers();
          emitAuthState(ok);
          if (ok) {
            player.youtubeDataAPI.invalidateUserResources();
            emitToFrontend("dataChanged", { key: "userPlaylists" });
            emitToFrontend("dataChanged", { key: "userSubscriptions" });
            const email = player.googleAuth.authState.email ?? "";
            const script = `<script>window.close();</script><p style="font-family:sans-serif">Signed in as <b>${email}</b>! You can close this window and return to the app.</p>`;
            return new Response(script, { headers: { "content-type": "text/html" } });
          }
          return new Response("Sign-in failed", { status: 400 });
        }
        return new Response("Not Found", { status: 404 });
      };
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: handleCallback,
      });
      servers.push(server);
      callbackPort = server.port!;
      console.log(callbackPort);
      timeout = setTimeout(() => {
        closeServers();
        emitAuthState(false);
      }, 300_000);

      // localhost resolves to ::1 too; listen on both loopback stacks so the
      // browser's IPv6-first connection to localhost isn't refused.
      try {
        servers.push(Bun.serve({
          hostname: "::1",
          port: callbackPort,
          fetch: handleCallback,
        }));
      } catch {
        // IPv6 loopback unavailable — IPv4-only still works on most setups
      }
      const authUrl = await player.googleAuth.getAuthUrl(callbackPort);
      return { success: true, authUrl, port: callbackPort };
    }),

    signOut: withErrorLogEmit("signOut", async () => {
      player.googleAuth.signOut();
      player.youtubeDataAPI.invalidateUserResources(true);
      emitToFrontend("dataChanged", { key: "userPlaylists" });
      emitToFrontend("dataChanged", { key: "userSubscriptions" });
    }),

    getUserYoutubePlaylists: withErrorLogEmit("getUserYoutubePlaylists", async () => {
      return player.youtubeDataAPI.getUserPlaylists();
    }),

    getUserYoutubeSubscriptions: withErrorLogEmit("getUserYoutubeSubscriptions", async () => {
      return player.youtubeDataAPI.getUserSubscriptions();
    }),

    getUserYoutubePlaylistTracks: withErrorLogEmit("getUserYoutubePlaylistTracks", async ({ playlistId }: { playlistId: string }) => {
      return player.youtubeDataAPI.getPlaylistTracks(playlistId);
    }),
  };
}
