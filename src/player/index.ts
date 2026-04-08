import { PlayerRPCType, SleepMode, Track } from "@/shared/types.ts";
import { Electroview } from "electrobun/view";

let playing: { id?: string | null; source?: string; index?: string } = JSON.parse(localStorage.getItem("playing") ?? "{}");
let volume = Number(localStorage.getItem("volume") ?? 50);
let isPlayed = localStorage.getItem("isPlayed") === "1";
let isRepeat = localStorage.getItem("isRepeat") === "1";
let sleep = localStorage.getItem("sleep") as SleepMode;
let isFirstLoad = true;

const audioRef = new Audio();
let ytPlayerInstance: any = null;

enum YoutubePlaybackState {
    Unstarted = -1, Ended = 0, Playing = 1, Paused = 2, Buffering = 3, Cued = 5,
}

// @ts-ignore
const rpc = Electroview.defineRPC<PlayerRPCType>({
    maxRequestTime: 60 * 1000,
    handlers: {
        requests: {
            seekTo: (time: number) => {
                const currentTime = playing.source === "local" ? audioRef.currentTime : ytPlayerInstance?.getCurrentTime?.();
                if (time !== currentTime && time !== null && time !== undefined) {
                    if (playing.source === "local" && audioRef.readyState >= 1) {
                        audioRef.currentTime = time;
                    } else if (ytPlayerInstance && typeof ytPlayerInstance.seekTo === "function") {
                        ytPlayerInstance.seekTo(time, true);
                    }
                }
            },
            setVolume: (newVolume: number) => {
                volume = newVolume;
                localStorage.setItem("volume", String(volume));
                if (playing.source === "local" && audioRef.volume !== volume / 100) {
                    audioRef.volume = volume / 100;
                } else if (ytPlayerInstance && typeof ytPlayerInstance.setVolume === "function") {
                    ytPlayerInstance.setVolume(volume);
                }
            },
            playTrack: (track: Track) => {
                localStorage.setItem("playing", JSON.stringify(track));
                loadTrack(track).then(() => { if (track) playCurrentTrack(); });
            },
            togglePlayPause: () => {
                const storedIsPlayed = localStorage.getItem("isPlayed") !== "1";
                setIsPlayedState(storedIsPlayed);
            },
            setIsRepeat: (repeat: boolean) => {
                isRepeat = repeat;
                localStorage.setItem("isRepeat", repeat ? "1" : "0");
            },
            setSleep: (newSleep: SleepMode) => {
                sleep = newSleep;
                localStorage.setItem("sleep", sleep);
            },
        },
    },
});

window.api = new Electroview({ rpc: rpc }) as any;

const handleCloseTab = () => {
    try {
        window.api.rpc.request.sleep();
        return "yes";
    } catch {
        return "no";
    }
};

const check_eot = () => {
    if (sleep === SleepMode.eot) {
        localStorage.setItem("sleep", "no");
        const res = handleCloseTab();
        if (res === "no") {
            setIsPlayedState(false);
            localStorage.setItem("isPlayed", "0");
        }
    }
};

setInterval(() => {
    window.api.rpc.request.setcurrentTime(
        playing.source === "local" ? audioRef.currentTime : ytPlayerInstance.getCurrentTime()
    )
    window.api.rpc.request.setIsLive(
        playing.source === "youtube" ? ytPlayerInstance.getVideoData().isLive : false
    )
}, 1000);

const isCurrentlyPlaying = () => {
    if (playing.source === "local") {
        return !audioRef.paused && audioRef.currentTime > 0 && !audioRef.ended;
    } else if (ytPlayerInstance && typeof ytPlayerInstance.getPlayerState === "function") {
        return ytPlayerInstance.getPlayerState() === YoutubePlaybackState.Playing;
    }
    return false;
};

const playCurrentTrack = () => {
    if (playing.source === "local") {
        audioRef.play().catch((e) => console.error("Audio play error", e));
    } else if (ytPlayerInstance?.playVideo) {
        ytPlayerInstance.playVideo();
    }
    window.api.rpc.request.setIsPlaying(true);
    localStorage.setItem("isPlayed", "1");
    isFirstLoad = false;
};

const pauseCurrentTrack = () => {
    if (playing.source === "local") {
        audioRef.pause();
    } else if (ytPlayerInstance?.pauseVideo) {
        ytPlayerInstance.pauseVideo();
    }
    window.api.rpc.request.setIsPlaying(false);
    localStorage.setItem("isPlayed", "0");
};

const setIsPlayedState = (newState: boolean) => {
    isPlayed = newState;
    if (isPlayed && !isCurrentlyPlaying()) {
        playCurrentTrack();
    } else if (!isPlayed && isCurrentlyPlaying()) {
        pauseCurrentTrack();
    }
};

const loadTrack = async (track: any) => {
    const { source, id, index } = track;
    if (!source || id === null || id === undefined) return;
    playing = { id, source, index };

    isPlayed = false;
    audioRef.pause();
    ytPlayerInstance?.stopVideo?.();

    localStorage.setItem("isPlayed", "0");
    window.api.rpc.request.setLoading(true);
    window.api.rpc.request.setIsPlaying(false);

    if (source === "local") {
        audioRef.removeAttribute("src");
        audioRef.load();

        const streamUrl = `http://localhost:${window.location.port}/music?path=${encodeURIComponent(index)}`;

        audioRef.src = streamUrl;
        audioRef.volume = volume / 100;
        audioRef.load();

        window.api.rpc.request.setLoading(false);
    } else {
        if (ytPlayerInstance && typeof ytPlayerInstance.loadVideoById === "function") {
            ytPlayerInstance.loadVideoById(id);
            if (ytPlayerInstance.getVolume() !== volume) {
                ytPlayerInstance.setVolume(volume);
            }
            if (ytPlayerInstance.getVideoData().isLive && isFirstLoad) {
                ytPlayerInstance.seekTo(Infinity, true);
                window.api.rpc.request.setcurrentTime(ytPlayerInstance.getCurrentTime());

                playCurrentTrack();
            }
            else {
                window.api.rpc.request.setcurrentTime(0);
                if (!isFirstLoad) {
                    isPlayed = true;
                }
            }

        }
        window.api.rpc.request.setLoading(false);
    }
};

audioRef.addEventListener("ended", () => {
    check_eot();
    if (isRepeat) {
        audioRef.currentTime = 0;
        isPlayed = true;
        isFirstLoad = false;
        playCurrentTrack();
    } else {
        window.api.rpc.request.endTrack();
    }
});

audioRef.addEventListener("loadedmetadata", () => {
    if (audioRef.duration === Infinity) {
        audioRef.currentTime = 1e101;
        audioRef.ontimeupdate = () => {
            audioRef.ontimeupdate = null;
            audioRef.currentTime = 0;
        };
    }
    window.api.rpc.request.setcurrentTime(0);
});

if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => {
        isPlayed = true;
        localStorage.setItem("isPlayed", "1");
        audioRef.play();
        window.api.rpc.request.setIsPlaying(true);
        navigator.mediaSession.playbackState = "playing";
    });

    navigator.mediaSession.setActionHandler("pause", () => {
        isPlayed = false;
        localStorage.setItem("isPlayed", "0");
        audioRef.pause();
        window.api.rpc.request.setIsPlaying(false);
        navigator.mediaSession.playbackState = "paused";
    });
}

const onPlayerStateChange = (event: any) => {
    const state = event.data;
    if (state === YoutubePlaybackState.Playing) {
        window.api.rpc.request.setLoading(false);
        isPlayed = true;
        localStorage.setItem("isPlayed", "1");
        window.api.rpc.request.setIsPlaying(true);

        if (isFirstLoad) {
            isFirstLoad = false;
            event.target.pauseVideo();
            window.api.rpc.request.setIsPlaying(false);
        } else {
            event.target.playVideo();
            window.api.rpc.request.setIsPlaying(true);
        }
    } else if (state === YoutubePlaybackState.Paused) {
        isPlayed = false;
        localStorage.setItem("isPlayed", "0");
        window.api.rpc.request.setIsPlaying(false);
    } else if (state === YoutubePlaybackState.Ended) {
        if (isRepeat) {
            event.target.seekTo(0);
            event.target.playVideo();
            isPlayed = true;
        } else {
            window.api.rpc.request.endTrack();
        }
    }
};

const initializePlayer = () => {
    if ((window as any).playerInstance) return;

    const ytDiv = document.createElement("div");
    ytDiv.id = "yt-player-container";
    ytDiv.style.display = "none";
    document.body.appendChild(ytDiv);

    new (window as any).YT.Player(ytDiv, {
        height: "0", width: "0",
        playerVars: { controls: 0, autoplay: 0, enablejsapi: 1, origin: window.location.origin },
        events: {
            onReady: (event: any) => {
                ytPlayerInstance = event.target;
                (window as any).playerInstance = event.target;
                loadTrack(playing);
            },
            onStateChange: onPlayerStateChange,
        },
    });
};

(window as any).onYouTubeIframeAPIReady = initializePlayer;

if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
} else {
    initializePlayer();
}


localStorage.setItem("isPlayed", "0");
localStorage.setItem("time", "0");