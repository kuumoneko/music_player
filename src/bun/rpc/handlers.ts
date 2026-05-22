import { Utils, Updater } from "electrobun/bun";
import type DiscordRPC from "../discord/index.ts";
import type Player from "../music/index.ts";
import type { WindowManager } from "../window/manager.ts";
import DownloadController from "../controllers/download.ts";
import HomeController from "../controllers/home.ts";
import MusicController from "../controllers/music.ts";
import formatArtists from "../../shared/utils/formatArtist.ts";
import { SleepMode, Repeat } from "../../shared/types.ts";
import type { UserData } from "../../shared/types.ts";
import type { System } from "../../shared/types.ts";
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

export function createRpcHandlers(ctx: RpcContext) {
  const { player, windowManager, current, isLocal, isDiscord, DiscordClientId, emitToFrontend, play } = ctx;

  return {
    getMusicData: async ({ source, type, id }: { source: "youtube" | "local"; type: string; id: string }) => {
      try {
        const result = await MusicController(player, {
          source,
          type,
          id,
          query: "",
          mode: "",
        });
        return result;
      } catch (error) {
        writeLogs([{
          type: "error",
          message: `Error when getting music data with:\nSource = ${source}\nMode = ${type}\nId = ${id}\n ${error}`,
        }]);
        return null;
      }
    },

    getLocalfile: async () => {
      try {
        return getAllLocalFiles();
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when getting Local files:\n${error}` }]);
        return null;
      }
    },

    searchMusic: async ({ type, query }: { type: "video" | "playlist" | "artist"; query: string }) => {
      try {
        const result = await MusicController(player, {
          source: "youtube",
          id: "",
          type,
          query,
          mode: "search",
        });
        return result;
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when searching music data with:\nType = ${type}\nQuery = ${query}\n${error}` }]);
        return null;
      }
    },

    getHomeData: async () => {
      try {
        const pin = getUserData("pin");
        const result = await HomeController(player, pin);
        return result;
      } catch (error) {
        writeLogs([{ type: "error", message: `Unexpected error when getting home data:\n${error}` }]);
        return null;
      }
    },

    getSystem: (key: keyof System) => {
      return key === "isDiscord" ? isDiscord : isLocal;
    },

    downloadMusic: async () => {
      try {
        const downloadQueue = getUserData("downloadQueue");
        if (downloadQueue.length === 0) {
          throw new Error("No download queue");
        }
        if (!isLocal) {
          throw new Error("User dont set this app has local file");
        }
        return await DownloadController(player);
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when preparing download music:\n${error}` }]);
        return null;
      }
    },

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
          writeUserData("folder", value[0]);
          player.local.getfolder(value[0]);

          return value[0];
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
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when writing user data with\nKey = ${key}\nValue = ${data}\n${error}` }]);
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
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when switching to next track\n${error}` }]);
        return null;
      }
    },

    previous: async () => {
      try {
        player.player.previous();
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when switching to previous track\n${error}` }]);
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
          source: track.source,
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
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when changing time\n${error}` }]);
        return null;
      }
    },

    setSleep: async (mode: SleepMode) => {
      try {
        player.player.setSleep(mode);
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when setting Sleep mode\n${error}` }]);
        return null;
      }
    },

    checkUpdate: async () => {
      try {
        const { version } = await Updater.getLocallocalInfo();
        const { updateAvailable } = await Updater.checkForUpdate();
        return updateAvailable === true ? updateAvailable : version;
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when checking for update\n${error}` }]);
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
      } catch (error) {
        writeLogs([{ type: "error", message: `Error when connecting with Discord\n${error}` }]);
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
