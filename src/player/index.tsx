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
                localStorage.setItem("seekTo", String(time));
            },
            setVolume: (volume: number) => {
                localStorage.setItem("volume", String(volume));
            },
            playTrack: (track: Track) => {
                localStorage.setItem("playing", JSON.stringify(track));
            },
            togglePlayPause: () => {
                const isPlaying =
                    localStorage.getItem("isPlayed") === "1" ? true : false;
                localStorage.setItem("isPlayed", isPlaying ? "0" : "1");
            },
            setIsRepeat: (repeat: boolean) => {
                localStorage.setItem("isRepeat", repeat ? "1" : "0");
            },
            setSleep: (sleep: SleepMode) => {
                localStorage.setItem("sleep", sleep);
            },
        },
    },
});

window.api = new Electroview({ rpc: rpc }) as any;
localStorage.setItem("isPlayed", "0");
localStorage.setItem("time", "0");

createRoot(document.getElementById("root")!).render(<Player />);
