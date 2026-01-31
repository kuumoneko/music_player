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
    // --- State ---
    const [played, setplayed] = useState(false);
    const [shuffle, setshuffle] = useState("disable");
    const [repeat, setrepeat] = useState("disable");
    const [isloading, setisloading] = useState(true);

    const [currentTrack, setCurrentTrack] = useState({ source: "", id: "" });
    const [player, setPlayer] = useState<any>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);

    const [Time, setTime] = useState(0);
    const [duration, setduraion] = useState(0);
    const [playedsongs, setplayedsongs] = useState([]);

    const TimeSliderRef = useRef<HTMLInputElement>(null);

    // --- 1. One-time Setup: Load Songs & Youtube API ---
    useEffect(() => {
        setplayedsongs(localstorage("get", "playedsongs", []));

        // Define the callback globally so the API script can find it
        (window as any).onYouTubeIframeAPIReady = () => {
            initializePlayer();
        };

        // Inject the API script if it's not there
        if (!window.YT) {
            // [!] FIX: Dynamic origin handling.
            // If on file://, we default to localhost or a specific domain to satisfy YT API.
            const origin = window.location.origin.startsWith("http")
                ? window.location.origin
                : "http://localhost:3000";

            const tag = document.createElement("script");
            tag.src = `https://www.youtube.com/iframe_api?origin=${origin}`;
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        } else {
            // If API is already loaded, init immediately
            initializePlayer();
        }
    }, []);

    // --- 2. Initialize Player Instance (Run Once) ---
    const initializePlayer = () => {
        if (!playerContainerRef.current || (window as any).playerInstance)
            return;

        // Create player without a specific video initially
        const newPlayer = new (window as any).YT.Player(
            playerContainerRef.current,
            {
                height: "0",
                width: "0",
                playerVars: {
                    controls: 0,
                    autoplay: 0,
                    enablejsapi: 1,
                    // [!] FIX: Ensure origin is passed here too
                    origin: window.location.origin,
                },
                events: {
                    onReady: (event: any) => {
                        setPlayer(event.target);
                        // Store strict reference if needed
                        (window as any).playerInstance = event.target;
                    },
                    onStateChange: onPlayerStateChange,
                },
            },
        );
        setPlayer(newPlayer);
    };

    // --- 3. Player Event Handlers ---
    const onPlayerStateChange = (event: any) => {
        const state = event.data;

        if (state === YoutubePlaybackState.Playing) {
            const newDuration = event.target.getDuration();
            if (newDuration > 0) setduraion(newDuration);
            setisloading(false);
            setplayed(true);
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
                forward(setCurrentTrack);
            }
        }
    };

    // --- 4. Watch for Track Changes (Logic) ---
    useEffect(() => {
        let isMounted = true; // To prevent race conditions on async fetch

        const loadTrack = async () => {
            let { source, id } = currentTrack;

            if (!source || !id) return;

            setisloading(true);

            // [!] FIX: Resolve Spotify ID to YouTube ID
            if (source === "spotify") {
                try {
                    const temp = await fetchdata(`play`, "GET", { source, id });
                    if (!isMounted) return; // Stop if user skipped song while fetching
                    id = temp;
                } catch (e) {
                    console.error("Failed to resolve spotify track", e);
                    setisloading(false);
                    return;
                }
            }

            // [!] FIX: Use loadVideoById instead of recreating player
            if (player && typeof player.loadVideoById === "function") {
                player.loadVideoById(id);
                // Usually loadVideoById starts playing automatically,
                // but we sync with 'played' state
                if (played) player.playVideo();
                const volume = localstorage("get", "volume", 50);
                alert(volume);
                if (volume && player.getVolume() !== Number(volume)) {
                    player.setVolume(Number(volume));
                }
            } else if (!player) {
                // If player isn't ready yet, it will load this ID when it inits
                // (This is a rare edge case if API loads slowly)
            }
        };

        loadTrack();

        return () => {
            isMounted = false;
        };
    }, [currentTrack]); // Only run when internal track state changes

    // --- 5. Poll for Song Updates (Storage -> State) ---
    useEffect(() => {
        const checkStorage = () => {
            const playing = localstorage("get", "playing", {});

            // Only update if the ID actually changed to prevent loops
            if (
                playing.id &&
                (playing.id !== currentTrack.id ||
                    playing.source !== currentTrack.source)
            ) {
                setCurrentTrack({ id: playing.id, source: playing.source });

                // Update Metadata
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
            }
        };

        const run = setInterval(checkStorage, 500);
        return () => clearInterval(run);
    }, [currentTrack]);

    // --- 6. Sync Play/Pause State ---
    useEffect(() => {
        if (!player || typeof player.playVideo !== "function") return;

        if (played) {
            // Only call play if not already playing (optional optimization)
            if (player.getPlayerState() !== YoutubePlaybackState.Playing) {
                player.playVideo();
            }
        } else {
            if (player.getPlayerState() === YoutubePlaybackState.Playing) {
                player.pauseVideo();
            }
        }
    }, [played, player]);

    // --- 7. Progress & Volume Polling ---
    useEffect(() => {
        const run = setInterval(() => {
            if (player && typeof player.getCurrentTime === "function") {
                // Only update time if playing or buffering
                if (player.getPlayerState() === YoutubePlaybackState.Playing) {
                    setTime(player.getCurrentTime());
                }

                // Sync Volume
                const volume = localstorage("get", "volume", 50);
                if (volume && player.getVolume() !== Number(volume)) {
                    player.setVolume(Number(volume));
                }
            }

            // Sync settings from local storage
            setrepeat(localstorage("get", "repeat", "disable"));
            setshuffle(localstorage("get", "shuffle", "disable"));
            setplayed(localstorage("get", "played", "false"));
        }, 500);

        return () => clearInterval(run);
    }, [player]);

    // --- 8. Slider Visual Update ---
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

    // --- 9. Media Session Handlers ---
    useEffect(() => {
        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () =>
                setplayed(true),
            );
            navigator.mediaSession.setActionHandler("pause", () =>
                setplayed(false),
            );
            navigator.mediaSession.setActionHandler("nexttrack", () =>
                forward(setCurrentTrack),
            );
            navigator.mediaSession.setActionHandler("previoustrack", () =>
                backward(),
            );
        }
    }, []);

    const check_eot = (temp: sleep_types) => {
        if (temp === sleep_types.eot) {
            localstorage("set", "kill time", sleep_types.no);
            const res = handleCloseTab();
            if (res === "no") {
                setplayed(false);
                alert(
                    "I can't close this tab by script. Please close it by yourself.",
                );
            }
        }
    };

    const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = Number(e.target.value);
        setTime(newTime);
        if (player) {
            player.seekTo(newTime, true);
        }
    };

    return (
        <div className="flex flex-col items-center">
            {/* Hidden Player Container */}
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
                        // localStorage.setItem("shuffle", new_shuffle);
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
                        await forward(setCurrentTrack);
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
