import { useState, useEffect, useRef, RefObject } from "react";
import { sleep_types } from "@/types";
import {
    faShuffle,
    faStepBackward,
    faPause,
    faPlay,
    faStepForward,
    faRepeat,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDuration } from "@/utils/format.ts";
import Slider from "@/components/Player/common/Slider";
import backward from "./common/backward.ts";
import forward from "./common/forward.ts";
import fetchdata from "@/utils/fetch.ts";
import localstorage from "@/utils/localStorage.ts";

enum YoutubePlaybackState {
    Unstarted = -1,
    Ended = 0,
    Playing = 1,
    Paused = 2,
    Buffering = 3,
    Cued = 5,
}

const handleCloseTab = () => {
    try {
        window.electronAPI.close();
    } catch {
        return "no";
    }
};

export default function ControlUI() {
    const isFirstLoad = useRef(true);
    const [played, setplayed] = useState(false);
    const [shuffle, setshuffle] = useState("disable");
    const [repeat, setrepeat] = useState("disable");
    const [isloading, setisloading] = useState(true);

    const currentTrack = useRef<{ source: string; id: string }>(
        localstorage("get", "playing", { source: "", id: "" }),
    );

    const player = useRef<any>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    (audioRef.current as any).isPlaying = () => {
        if (audioRef.current.paused) {
            return YoutubePlaybackState.Paused;
        } else {
            return YoutubePlaybackState.Playing;
        }
    };
    (audioRef.current as any).getDuration = () => {
        return audioRef.current.duration;
    };
    (audioRef.current as any).seek = (data: number) => {
        audioRef.current.currentTime = data;
    };
    (audioRef.current as any).getCurrentTime = () => {
        return audioRef.current.currentTime;
    };
    (audioRef.current as any).getVolume = () => {
        return audioRef.current.volume;
    };
    (audioRef.current as any).setVolume = (data: number) => {
        audioRef.current.volume = data / 100;
    };
    const [Time, setTime] = useState(0);
    const [duration, setduraion] = useState(0);
    const [playedsongs, setplayedsongs] = useState([]);

    const TimeSliderRef = useRef<HTMLInputElement>(null);

    const check_eot = (temp: sleep_types) => {
        if (temp === sleep_types.eot) {
            localstorage("set", "kill time", sleep_types.no);
            const res = handleCloseTab();
            if (res === "no") {
                setplayed(false);
            }
        }
    };

    const loadTrack = async (source: string, id: string) => {
        if (!source || !id) return;

        setisloading(true);
        if (source === "local") {
            const temp = await fetchdata(`play`, "GET", { source, id });
            const audio_format = id.split(".")[id.split(".").length - 1];

            const byteCharacters = atob(temp);
            const byteArrays: any = [];

            for (let i = 0; i < byteCharacters.length; i += 1024) {
                const slice = byteCharacters.slice(i, i + 1024);
                const byteNumbers = new Array(slice.length);
                for (let j = 0; j < slice.length; j++) {
                    byteNumbers[j] = slice.charCodeAt(j);
                }
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }
            const blob = new Blob(byteArrays, {
                type: `audio/${audio_format}`,
            });

            const blobUrl = URL.createObjectURL(blob);
            player.current.stopVideo();
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load();

            audioRef.current = new Audio(blobUrl);
            audioRef.current.load();
            audioRef.current.addEventListener("ended", () => {
                const currentRepeat = localstorage("get", "repeat", "disable");
                const sleepMode = localstorage(
                    "get",
                    "kill time",
                    sleep_types.no,
                );

                check_eot(sleepMode as sleep_types);

                if (currentRepeat === "one" && audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                    setplayed(true);
                } else {
                    forward(loadTrack);
                }
            });
            audioRef.current.addEventListener("loadedmetadata", () => {
                setduraion(audioRef.current.duration);
                if (audioRef.current.duration === Infinity) {
                    audioRef.current.currentTime = 1e101;
                    audioRef.current.ontimeupdate = () => {
                        audioRef.current.ontimeupdate = null;
                        audioRef.current.currentTime = 0;
                    };
                }
            });
            currentTrack.current = {
                id: id,
                source: source,
            };
            const volume = localstorage("get", "volume", 50);
            if (volume && audioRef.current) {
                audioRef.current.volume = volume / 100;
            }
            setTime(0);
            setisloading(false);
        } else {
            let playedId = id;
            if (source === "spotify") {
                try {
                    const temp = await fetchdata(`play`, "GET", { source, id });
                    playedId = temp;
                } catch (e) {
                    console.error("Failed to resolve spotify track", e);
                    setisloading(false);
                    return;
                }
            }

            if (
                player.current &&
                typeof player.current.loadVideoById === "function"
            ) {
                currentTrack.current = {
                    id: id,
                    source: source,
                };
                audioRef.current.pause();
                audioRef.current.src = "";
                player.current.loadVideoById(playedId);
                const volume = localstorage("get", "volume", 50);
                if (
                    volume &&
                    player.current &&
                    player.current.getVolume() !== Number(volume)
                ) {
                    player.current.setVolume(Number(volume));
                }
                setTime(0);
                setisloading(false);
            } else if (!player.current) {
                window.discord.clearmusic();
            }
        }
    };

    useEffect(() => {
        setplayedsongs(localstorage("get", "playedsongs", []));

        (window as any).onYouTubeIframeAPIReady = () => {
            initializePlayer();
        };

        if (!window.YT) {
            const tag = document.createElement("script");
            tag.src = `https://www.youtube.com/iframe_api`;
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        } else {
            initializePlayer();
        }
    }, []);

    const initializePlayer = () => {
        if (!playerContainerRef.current || (window as any).playerInstance)
            return;

        const newPlayer = new (window as any).YT.Player(
            playerContainerRef.current,
            {
                height: "0",
                width: "0",
                playerVars: {
                    controls: 0,
                    autoplay: 0,
                    enablejsapi: 1,
                    origin: window.location.origin,
                },

                events: {
                    onReady: (event: any) => {
                        player.current = event.target;
                        loadTrack(
                            currentTrack.current.source,
                            currentTrack.current.id,
                        );
                        player.current.isPlaying = event.target.getPlayerState;
                        player.current.play = event.target.playVideo;
                        player.current.pause = event.target.pauseVideo;
                        player.current.seek = event.target.seekTo;
                        player.current.getVolume = event.target.getVolume;

                        (window as any).playerInstance = event.target;
                    },
                    onStateChange: onPlayerStateChange,
                },
            },
        );
        if (newPlayer) {
        }
    };

    const onPlayerStateChange = (event: any) => {
        const state = event.data;

        if (state === YoutubePlaybackState.Playing) {
            const newDuration = event.target.getDuration();
            if (newDuration > 0) setduraion(newDuration);
            setisloading(false);
            setplayed(true);
            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                event.target.pauseVideo();
            }
        }

        if (state === YoutubePlaybackState.Paused) {
            setplayed(false);
        }

        if (state === YoutubePlaybackState.Ended) {
            const curr_player = event.target;
            const currentRepeat = localstorage("get", "repeat", "disable");
            const sleepMode = localstorage("get", "kill time", sleep_types.no);

            check_eot(sleepMode as sleep_types);

            if (currentRepeat === "one" && curr_player) {
                curr_player.seekTo(0);
                curr_player.playVideo();
                setplayed(true);
            } else {
                forward(loadTrack);
            }
        }
    };

    useEffect(() => {
        const checkStorage = async () => {
            const playing = localstorage("get", "playing", {});
            if ("mediaSession" in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: playing.name,
                    artist: playing.artists,
                    artwork: [
                        {
                            src: playing.thumbnail,
                            sizes: "512x512",
                            type: "image/png",
                        },
                    ],
                });
            }

            if (
                playing.id &&
                (playing.id !== currentTrack.current.id ||
                    playing.source !== currentTrack.current.source)
            ) {
                await loadTrack(playing.source, playing.id);
                if (played) {
                    if (playing.source === "local") {
                        audioRef.current.play();
                    } else {
                        player.current.playVideo();
                    }
                }
            }
        };
        const run = setInterval(checkStorage, 500);
        return () => clearInterval(run);
    }, []);

    useEffect(() => {
        if (!player.current || typeof player.current.playVideo !== "function")
            return;
        const this_player =
            currentTrack.current.source === "local"
                ? audioRef.current
                : player.current;

        if (played) {
            if (this_player.isPlaying() !== YoutubePlaybackState.Playing) {
                this_player.play();
            }
        } else {
            if (this_player.isPlaying() === YoutubePlaybackState.Playing) {
                this_player.pause();
            }
        }
    }, [played]);

    useEffect(() => {
        const run = setInterval(() => {
            const this_player =
                currentTrack.current.source === "local"
                    ? audioRef.current
                    : player.current;
            if (this_player) {
                if (this_player.isPlaying() === YoutubePlaybackState.Playing) {
                    setTime(this_player.getCurrentTime());
                    const now = new Date().getTime();
                    const start =
                        now - (this_player.getCurrentTime() ?? Time) * 1000;
                    const end = start + this_player.getDuration() * 1000;

                    window.discord.setmusic({
                        ...localstorage("get", "playing", {}),
                        start,
                        end,
                        isPlaying: true,
                    });
                }

                const volume = localstorage("get", "volume", 50);
                if (volume && this_player.getVolume() !== Number(volume)) {
                    this_player.setVolume(Number(volume));
                }
            }

            setrepeat(localstorage("get", "repeat", "disable"));
            setshuffle(localstorage("get", "shuffle", "disable"));
        }, 500);

        return () => clearInterval(run);
    }, [player]);

    useEffect(() => {
        if (TimeSliderRef.current) {
            const min = Number(TimeSliderRef.current.min);
            const max = Number(TimeSliderRef.current.max);
            const percent = max > 0 ? ((Time - min) / (max - min)) * 100 : 0;
            TimeSliderRef.current.style.setProperty(
                "--value-percent",
                `${percent}%`,
            );
        }
    }, [Time]);

    useEffect(() => {
        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () =>
                setplayed(true),
            );
            navigator.mediaSession.setActionHandler("pause", () =>
                setplayed(false),
            );
            navigator.mediaSession.setActionHandler("nexttrack", () =>
                forward(loadTrack),
            );
            navigator.mediaSession.setActionHandler("previoustrack", () =>
                backward(),
            );
        }
    }, []);

    const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = Number(e.target.value);
        setTime(newTime);
        const this_player =
            currentTrack.current.source === "local"
                ? audioRef.current
                : player.current;
        if (this_player) {
            this_player.seek(newTime, true);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div
                ref={playerContainerRef}
                className="pointer-events-none absolute -top-full -left-full"
            />

            <div
                className={`controls flex flex-row gap-2.5 ${isloading ? "opacity-50 pointer-events-none" : ""}`}
            >
                {/* Shuffle */}
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none"
                    onClick={() => {
                        const new_shuffle =
                            shuffle === "disable" ? "enable" : "disable";
                        setshuffle(new_shuffle);
                        localstorage("set", "shuffle", new_shuffle);
                    }}
                >
                    <FontAwesomeIcon
                        icon={faShuffle}
                        className={shuffle === "disable" ? "" : "text-red-500"}
                    />
                </button>

                {/* Backward */}
                <button
                    className={`mx-0.5 p-0.5 cursor-default select-none ${playedsongs.length === 0 ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => backward()}
                >
                    <FontAwesomeIcon icon={faStepBackward} />
                </button>

                {/* Play/Pause */}
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none"
                    onClick={() => setplayed(!played)}
                >
                    <FontAwesomeIcon icon={played ? faPause : faPlay} />
                </button>

                {/* Forward */}
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none"
                    onClick={async () => {
                        localstorage("set", "playedsongs", []);
                        await forward(loadTrack);
                    }}
                >
                    <FontAwesomeIcon icon={faStepForward} />
                </button>

                {/* Repeat */}
                <button
                    className="relative mx-0.5 p-0.5 cursor-default select-none"
                    onClick={() => {
                        const new_repeat =
                            repeat === "disable"
                                ? "enable"
                                : repeat === "enable"
                                  ? "one"
                                  : "disable";
                        setrepeat(new_repeat);
                        localstorage("set", "repeat", new_repeat);
                    }}
                >
                    <FontAwesomeIcon
                        icon={faRepeat}
                        className={
                            repeat === "enable"
                                ? "text-red-500"
                                : repeat === "one"
                                  ? "text-green-500"
                                  : ""
                        }
                    />
                    {repeat === "one" && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold pointer-events-none">
                            1
                        </span>
                    )}
                </button>
            </div>

            <div className="player flex flex-row items-center">
                <span className="mr-1.25 cursor-default select-none text-xs w-24 text-center">
                    {duration > 0
                        ? `${formatDuration(Time)} / ${formatDuration(duration)}`
                        : `Loading`}
                </span>
                <Slider
                    name={"time"}
                    width={"800"}
                    reff={TimeSliderRef as RefObject<HTMLInputElement>}
                    value={Time}
                    Change={handleTimeSliderChange}
                    max={duration || 0}
                />
            </div>
        </div>
    );
}
