import { Utils, Updater } from "electrobun/bun";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import type DiscordRPC from "../discord/index.ts";
import type Player from "../music/index.ts";
import type { WindowManager } from "../window/manager.ts";
import DownloadController from "../controllers/download.ts";
import HomeController from "../controllers/home.ts";
import MusicController from "../controllers/music.ts";
import formatArtists from "../../shared/utils/formatArtist.ts";
import { SleepMode, Repeat } from "../../shared/types.ts";
import type { UserData } from "../../shared/types.ts";
import {
  getAllLocalFiles,
  getLocalFileById,
  getUserData,
  getUserDatas,
  writeLogs,
  writeUserData,
  writeUserDatas,
} from "../db/index.ts";

export interface RpcContext {
  player: Player;
  windowManager: WindowManager;
  current: { time: number; duration: number; isLived: boolean; isPlaying: boolean };
  isLocal: boolean;
  isDiscord: boolean;
  DiscordClientId: number;
  discordRPC: { instance: DiscordRPC | null };
  emitToFrontend: (message: string, payload: any) => void;
  setDiscordRPC: () => void;
  play: () => void;
}

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 500;

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

export function createRpcHandlers(ctx: RpcContext) {
  const { player, windowManager, current, isLocal, isDiscord, DiscordClientId, emitToFrontend, play } = ctx;

  return {
    getMusicData: withRateLimit(async ({ source, type, id }: { source: "youtube" | "local"; type: string; id: string }) => {
      try {
        const result = await MusicController(player, {
          source,
          type,
          id,
          query: "",
          mode: "",
        });
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{
          type: "error",
          message: `Error when getting music data with:\nSource = ${source}\nMode = ${type}\nId = ${id}\n ${message}`,
        }]);
        return null;
      }
    }, "getMusicData"),
    getQueueData: async (items: string[]) => {
      if (!items || items.length === 0) return [];
      const results = await Promise.all(items.map(async (entry) => {
        const parts = entry.split(":");
        const source = parts[0] as "youtube" | "local";
        const type = parts[1] || "tracks";
        const id = parts[2] || parts[1] || "";
        try {
          return await MusicController(player, { source, type, id, query: "", mode: "" });
        } catch {
          return null;
        }
      }));
      return results;
    },

    getLocalfile: async () => {
      try {
        return getAllLocalFiles();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when getting Local files:\n${message}` }]);
        return null;
      }
    },

    searchMusic: withRateLimit(async ({ type, query }: { type: "video" | "playlist" | "artist"; query: string }) => {
      try {
        const allowedTypes = ["video", "playlist", "artist"];
        if (!allowedTypes.includes(type)) {
          throw new Error(`Invalid search type: ${type}`);
        }
        if (!query || typeof query !== "string") {
          throw new Error("Search query is required");
        }
        if (query.length > 200) {
          throw new Error("Search query exceeds maximum length");
        }
        const sanitized = query.replace(/[\x00-\x1f]/g, "").trim();
        if (sanitized.length === 0) {
          throw new Error("Search query is empty after sanitization");
        }
        const result = await MusicController(player, {
          source: "youtube",
          id: "",
          type,
          query: sanitized,
          mode: "search",
        });
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when searching music data with:\nType = ${type}\nQuery = ${query}\n${message}` }]);
        return null;
      }
    }, "searchMusic"),

    getHomeData: withRateLimit(async () => {
      try {
        const pin = getUserData("pin");
        const result = await HomeController(player, pin);
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Unexpected error when getting home data:\n${message}` }]);
        return null;
      }
    }, "getHomeData"),

    getIsLocal: () => {
      return isLocal;
    },

    downloadMusic: withRateLimit(async () => {
      try {
        const downloadQueue = getUserData("downloadQueue");
        if (downloadQueue.length === 0) {
          throw new Error("No download queue");
        }
        if (!isLocal) {
          throw new Error("User dont set this app has local file");
        }
        return await DownloadController(player);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when preparing download music:\n${message}` }]);
        return null;
      }
    }, "downloadMusic"),

    getDownloadStatus: async () => {
      return !isLocal ? null : player.status;
    },

    close: async () => {
      const QuitonClose = getUserData("QuitonClose");
      windowManager.close(QuitonClose);
    },

    minimize: async () => {
      windowManager.minimize();
    },

    toggleQuitonClose: async () => {
      writeUserData("QuitonClose", !getUserData("QuitonClose"));
    },

    isQuitonClose: async () => {
      return getUserData("QuitonClose");
    },

    togglePlayPause: async () => {
      if (!player.player.isReady) return;
      player.player.togglePlayPause(!current.isPlaying);
      current.isPlaying = !current.isPlaying;
      emitToFrontend("playerStateChange", {
        isPlaying: current.isPlaying,
        isLoading: false,
        duration: current.duration,
        isLived: current.isLived,
      });
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
          const value = await Utils.openFileDialog({
            canChooseDirectory: true,
            canChooseFiles: false,
          });

          if (!value || value.length === 0) {
            return { ok: false, data: "No folder selected" };
          }

          const canonicalPath = resolve(value[0]);
          try {
            const stats = await stat(canonicalPath);
            if (!stats.isDirectory()) {
              return { ok: false, data: "Selected path is not a directory" };
            }
          } catch {
            return { ok: false, data: "Selected folder does not exist" };
          }

          writeUserData("folder", canonicalPath);
          player.local.getfolder(canonicalPath).then(() => {
            emitToFrontend("local-files-changed", null);
          });

          return canonicalPath;
        }

        writeUserData(key, data);

        if (key === "volume") {
          player.player.setVolume(data);
          emitToFrontend("settingsChanged", {
            shuffle: getUserData("shuffle"),
            repeat: getUserData("repeat"),
            volume: data,
          });
        }
        if (key === "repeat") {
          player.player.setRepeat(data === Repeat.One);
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

    next: async () => {
      try {
        player.player.next();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when switching to next track\n${message}` }]);
        return null;
      }
    },

    previous: async () => {
      try {
        player.player.previous();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when switching to previous track\n${message}` }]);
        return null;
      }
    },

    play: async ({ item, source, type, id }: { item: import("../../shared/types.ts").Track; source: "youtube" | "local"; type: string; id: string }) => {
      const user = getUserDatas(["playQueue", "currentPlaying", "shuffle", "repeat", "playedTrack", "nextfrom"]) as UserData;
      user.playQueue = [];
      player.player.setRepeat(false);

      if (source === "youtube") {
        const track = await player.youtube.fetch_track([item.id]);
        user.currentPlaying = {
          source,
          id: item.id,
          title: track[0].name,
          thumbnail: track[0].thumbnail,
          artist: formatArtists(track[0].artist),
        };
        current.duration = track[0].duration;
        user.nextfrom = `youtube:${type}:${id}`;
      } else if (source === "local") {
        const track = getLocalFileById(item.id);
        user.currentPlaying = {
          source: "local",
          id: item.id,
          title: track?.name,
          thumbnail: track?.thumbnail,
          artist: formatArtists(track?.artist),
        };
        current.duration = track?.duration;
        current.isLived = false;
        user.nextfrom = "local:local";
      }

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
      });
      emitToFrontend("queueChanged", {
        playQueue: user.playQueue,
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

    seekTo: async (time: number) => {
      try {
        current.time = time;
        player.player.seekTo(time);
        emitToFrontend("timeUpdate", { time: current.time, isPlaying: current.isPlaying });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when changing time\n${message}` }]);
        return null;
      }
    },

    setSleep: async (mode: SleepMode) => {
      try {
        player.player.setSleep(mode);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when setting Sleep mode\n${message}` }]);
        return null;
      }
    },

    checkUpdate: async () => {
      try {
        const { version } = await Updater.getLocallocalInfo();
        const { updateAvailable } = await Updater.checkForUpdate();
        return updateAvailable === true ? updateAvailable : version;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when checking for update\n${message}` }]);
        return null;
      }
    },

    update: async () => {
      Updater.applyUpdate();
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
          ctx.discordRPC.instance = new DiscordModule.default(String(DiscordClientId));
          try {
            await ctx.discordRPC.instance.connect();
            return ctx.discordRPC.instance?.username ?? false;
          } catch {
            Utils.showMessageBox({
              type: "info",
              title: "Discord Client is not running",
              message: "Please open Discord Client then Connect again.",
            });
            return false;
          }
        } else {
          Utils.showMessageBox({
            type: "info",
            title: "Discord RPC is not installed",
            message: "Please reinstall and set isDiscord is true.",
          });
          return null;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message: `Error when connecting with Discord\n${message}` }]);
        return null;
      }
    },

    sendError: (error: Error) => {
      writeLogs([
        { type: "error", message: error.name ?? "" },
        { type: "error", message: error.message ?? "" },
        { type: "error", message: error.stack ?? "" },
      ]);
    },

    openDevTools: () => {
      windowManager.openDevTools();
    },
  };
}
