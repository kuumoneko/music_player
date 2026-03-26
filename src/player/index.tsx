import type { PlayerRPCType, SleepMode, Track } from "@/shared/types.ts";
import { Electroview } from "electrobun/view";
import { createRoot } from "react-dom/client";
import Player from "./player";

// @ts-ignore
const rpc = Electroview.defineRPC<PlayerRPCType>({
    maxRequestTime: 60 * 1000,
    handlers: {
        requests: {
            seekTo: (time: number) => {
                window.dispatchEvent(
                    new CustomEvent("seekTo", {
                        detail: time,
                    }),
                );
            },
            setVolume: (volume: number) => {
                window.dispatchEvent(
                    new CustomEvent("setVolume", {
                        detail: volume,
                    }),
                );

                localStorage.setItem("volume", String(volume));
            },
            playTrack: (track: Track) => {
                window.dispatchEvent(
                    new CustomEvent("playTrack", {
                        detail: track,
                    }),
                );

                localStorage.setItem("playing", JSON.stringify(track));
            },
            togglePlayPause: () => {
                window.dispatchEvent(
                    new CustomEvent("togglePlayPause", {
                        detail:
                            localStorage.getItem("isPlayed") === "1"
                                ? true
                                : false,
                    }),
                );

                localStorage.setItem(
                    "isPlayed",
                    (localStorage.getItem("isPlayed") === "1" ? true : false)
                        ? "0"
                        : "1",
                );
            },
            setIsRepeat: (repeat: boolean) => {
                window.dispatchEvent(
                    new CustomEvent("setIsRepeat", {
                        detail: repeat,
                    }),
                );

                localStorage.setItem("isRepeat", repeat ? "1" : "0");
            },
            setSleep: (sleep: SleepMode) => {
                window.dispatchEvent(
                    new CustomEvent("setSleep", {
                        detail: sleep,
                    }),
                );

                localStorage.setItem("sleep", sleep);
            },
        },
    },
});

window.api = new Electroview({ rpc: rpc }) as any;
localStorage.setItem("isPlayed", "0");
localStorage.setItem("time", "0");

createRoot(document.getElementById("root")!).render(<Player />);
