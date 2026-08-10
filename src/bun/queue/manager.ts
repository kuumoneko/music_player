import Player from "../music/index.ts";
import { MusicSource, MusicType, Shuffle, Track, UserData } from "../../shared/types.ts";
import { YTB_TRACK_START } from "../../shared/constants.ts";
import {
  getAllLocalFiles,
  getTracks,
  getUserData,
  getUserDatas,
  writeUserData,
} from "../db/index.ts";
import { resolveId } from "../lib/hash.ts";

function shuffleArray<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export class QueueManager {
  private player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  async refillQueue(
    data: { filename: string; playing: boolean }[],
    emitToFrontend: (message: string, payload: any) => void,
  ) {
    if (!data) return;

    let isYTB = false;
    if (data[0].filename.includes(YTB_TRACK_START)) {
      isYTB = true;
      data = data.filter((item) => item.filename.includes(YTB_TRACK_START));
    } else {
      data = data.filter((item) => !item.filename.includes(YTB_TRACK_START));
    }

    const currentTrack = data.splice(0, 1)[0]?.filename;
    if (!currentTrack) return;

    const ids = data.map((item) =>
      isYTB ? item.filename.split(YTB_TRACK_START)[1] : item.filename,
    );

    const { nextfrom, playQueue, shuffle } = getUserDatas([
      "nextfrom",
      "playQueue",
      "shuffle",
    ]) as UserData;
    const playQueueIds = playQueue.map((entry) => entry.split(":").slice(-1)[0]);
    const nextFromQueue = ids.filter((item) => playQueueIds.includes(item));
    let resultIds: string[] = [];

    resultIds.push(...playQueueIds, ...nextFromQueue, ...ids);
    resultIds = [...new Set(resultIds)];

    if (resultIds.length < 20) {
      let activeNextfrom = nextfrom;

      if (playQueue.length === 0) {
        const batchQueue = getUserData("batchQueue") ?? [];
        if (batchQueue.length >= 2) {
          const allTracks: Track[] = [];
          for (const entry of batchQueue) {
            const [bSource, bType, bId] = entry.split(":");
            if (bSource === MusicSource.Youtube) {
              let tracks: Track[] = [];
              if (bType === MusicType.Artist) {
                tracks = (await this.player?.youtubeDataAPI?.fetchArtist(bId))?.tracks ?? [];
              } else if (bType === MusicType.Playlist) {
                tracks = (await this.player?.youtubeDataAPI?.fetchPlaylist(bId))?.tracks ?? [];
              }
              if (tracks.length > 0) {
                if (shuffle === Shuffle.Enable) {
                  shuffleArray(tracks);
                }
                allTracks.push(...tracks);
              }
            }
          }
          if (allTracks.length > 0) {
            activeNextfrom = batchQueue[batchQueue.length - 1];
            resultIds.push(...allTracks.map((t) => t.id));
            resultIds = [...new Set(resultIds)];
          }
          writeUserData("batchQueue", []);
        } else if (batchQueue.length === 1) {
          activeNextfrom = batchQueue[0];
          writeUserData("batchQueue", []);
        }
        writeUserData("nextfrom", activeNextfrom);
      }

      const [source, type, id] = activeNextfrom.split(":");
      if (type === MusicType.Track) {
        this.player.player?.setRepeat(true);
        return;
      }

      if (source === MusicSource.Youtube) {
        let tracks: Track[] = [];
        if (type === MusicType.Artist) {
          tracks = (await this.player?.youtubeDataAPI?.fetchArtist(id))?.tracks ?? [];
        } else if (type === MusicType.Playlist) {
          tracks = (await this.player?.youtubeDataAPI?.fetchPlaylist(id))?.tracks ?? [];
        }

        if (tracks?.length > 0) {
          if (shuffle === Shuffle.Enable) {
            shuffleArray(tracks);
            resultIds.push(
              ...tracks.slice(0, 25 - resultIds.length).map((item) => item.id),
            );
          } else {
            let index = 0;
            if (resultIds.length > 0) {
              index = tracks.findIndex(
                (item) => item.id === resultIds[resultIds.length - 1],
              );
            } else {
              index = tracks.findIndex(
                (item) =>
                  item.id === currentTrack.split(YTB_TRACK_START)[1],
              );
            }
            resultIds.push(
              ...Array.from(
                { length: 25 - resultIds.length + 1 },
                (_, i) => tracks[(index + i) % tracks.length],
              ).map((item) => item.id),
            );
          }
        }
      } else if (source === MusicSource.Local) {
        const localFiles = getAllLocalFiles();
        const otherTracks = localFiles.filter(
          (localItem) => localItem.id !== currentTrack,
        );

        if (otherTracks.length > 0) {
          if (shuffle === Shuffle.Enable) {
            shuffleArray(otherTracks);
            resultIds.push(
              ...otherTracks
                .slice(0, 25 - resultIds.length)
                .map((item) => item.id),
            );
          } else {
            const index = otherTracks.findIndex(
              (item) => item.id === currentTrack,
            );
            resultIds.push(
              ...Array.from(
                { length: 25 - resultIds.length + 1 },
                (_, i) => otherTracks[(index + i) % otherTracks.length],
              ).map((item) => item.id),
            );
          }
        } else {
          this.player.player?.setRepeat(true);
        }
      }

      writeUserData("nextfrom", activeNextfrom);
      resultIds = [...new Set(resultIds)];
      const resolvedIds = resultIds.map((rid) => resolveId(rid));
      let result: { url: string; thumbnail: string; title: string }[] =
        getTracks(resolvedIds).map((item) => {
          return {
            url:
              (item.source === MusicSource.Youtube ? YTB_TRACK_START : "") + item.id,
            thumbnail: item.thumbnail,
            title: item.name,
          };
        });

      result = result.filter((item) => item.url !== currentTrack);

      await this.player.player?.addTracks(result);
      const queueState = getUserDatas([
        "playQueue",
        "nextfrom",
        "playedTrack",
      ]) as UserData;
      emitToFrontend("queueChanged", {
        playQueue: queueState.playQueue,
        batchQueue: getUserData("batchQueue"),
        nextfrom: queueState.nextfrom,
        playedTrack: queueState.playedTrack,
      });
    }
  }
}
