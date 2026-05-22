import Player from "../music/index.ts";
import { Shuffle, UserData } from "../../shared/types.ts";
import {
  getAllLocalFiles,
  getTracks,
  getUserDatas,
  writeUserData,
} from "../db/index.ts";

const ytbTrackStart = "https://www.youtube.com/watch?v=";

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
    if (data[0].filename.includes(ytbTrackStart)) {
      isYTB = true;
      data = data.filter((item) => item.filename.includes(ytbTrackStart));
    } else {
      data = data.filter((item) => !item.filename.includes(ytbTrackStart));
    }

    const currentTrack = data.splice(0, 1)[0]?.filename;
    if (!currentTrack) return;

    const ids = data.map((item) =>
      isYTB ? item.filename.split(ytbTrackStart)[1] : item.filename,
    );

    const { nextfrom, playQueue, shuffle } = getUserDatas([
      "nextfrom",
      "playQueue",
      "shuffle",
    ]) as UserData;
    const notinQueue = ids.filter((item) => playQueue.includes(item));
    const resultIds: string[] = [];

    resultIds.push(...playQueue, ...notinQueue, ...ids);

    if (resultIds.length < 20) {
      const [source, mode, id] = nextfrom.split(":");
      if (mode?.includes("track")) {
        this.player.player.setRepeat(true);
        return;
      }

      if (source === "youtube") {
        let tracks: import("../../shared/types.ts").Track[] = [];
        if (mode?.includes("artist")) {
          tracks = (await this.player.youtube.fetch_artist(id)).tracks;
        } else if (mode?.includes("playlist")) {
          tracks = (await this.player.youtube.fetch_playlist(id)).tracks;
        }

        if (tracks?.length > 0) {
          if (shuffle === Shuffle.Enable) {
            for (let i = tracks.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
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
                  item.id === currentTrack.split(ytbTrackStart)[1],
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
      } else if (source === "local") {
        const localFiles = getAllLocalFiles();
        const otherTracks = localFiles.filter(
          (localItem) => localItem.id !== currentTrack,
        );

        if (otherTracks.length > 0) {
          if (shuffle === Shuffle.Enable) {
            for (let i = otherTracks.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
            }
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
          this.player.player.setRepeat(true);
        }
      }

      writeUserData("nextfrom", nextfrom);
      let result: { url: string; thumbnail: string; title: string }[] =
        getTracks(resultIds).map((item) => {
          return {
            url:
              (item.source === "youtube" ? ytbTrackStart : "") + item.id,
            thumbnail: item.thumbnail,
            title: item.name,
          };
        });

      result = [
        ...new Set(result.filter((item) => item.url !== currentTrack)),
      ];

      await this.player.player.addTracks(result);
      const queueState = getUserDatas([
        "playQueue",
        "nextfrom",
        "playedTrack",
      ]) as UserData;
      emitToFrontend("queueChanged", {
        playQueue: queueState.playQueue,
        nextfrom: queueState.nextfrom,
        playedTrack: queueState.playedTrack,
      });
    }
  }
}
