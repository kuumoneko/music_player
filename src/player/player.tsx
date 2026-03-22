import { SleepMode } from "../shared/types.ts";
import { useState, useEffect, useRef } from "react";

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
        window.api.rpc.request.sleep();
    } catch {
        return "no";
    }
};

export default function Player() {
    const isFirstLoad = useRef(true);

    const playing = useRef(JSON.parse(localStorage.getItem("playing") ?? "{}"));
    const player = useRef<any>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());

    const [volume, setVolume] = useState(
        Number(localStorage.getItem("volume") ?? 50),
    );
    const volumeRef = useRef(volume);

    const [isPlayed, setIsPlayed] = useState(
        localStorage.getItem("isPlayed") === "1",
    );
    const isPlayedRef = useRef(isPlayed);

    const [isRepeat, setIsRepeat] = useState(
        localStorage.getItem("isRepeat") === "1",
    );
    const isRepeatRef = useRef(isRepeat);

    const [sleep, setSleep] = useState(
        localStorage.getItem("sleep") as SleepMode,
    );
    const sleepRef = useRef(sleep);

    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);
    useEffect(() => {
        isPlayedRef.current = isPlayed;
    }, [isPlayed]);
    useEffect(() => {
        isRepeatRef.current = isRepeat;
    }, [isRepeat]);
    useEffect(() => {
        sleepRef.current = sleep;
    }, [sleep]);

    const check_eot = (temp: SleepMode) => {
        if (temp === SleepMode.eot) {
            localStorage.setItem("sleep", SleepMode.no);
            const res = handleCloseTab();
            if (res === "no") {
                setIsPlayed(false);
                localStorage.setItem("isPlayed", "0");
            }
        }
    };

    const isCurrentlyPlaying = () => {
        if (playing.current.source === "local") {
            return (
                !audioRef.current.paused &&
                audioRef.current.currentTime > 0 &&
                !audioRef.current.ended
            );
        } else if (
            player.current &&
            typeof player.current.getPlayerState === "function"
        ) {
            return (
                player.current.getPlayerState() === YoutubePlaybackState.Playing
            );
        }
        return false;
    };

    const playCurrentTrack = () => {
        if (playing.current.source === "local") {
            audioRef.current
                .play()
                .catch((e) => console.error("Audio play error", e));
        } else if (player.current?.playVideo) {
            player.current.playVideo();
        }
        window.api.rpc.request.setIsPlaying(true);
        localStorage.setItem("isPlayed", "1");
    };

    const pauseCurrentTrack = () => {
        if (playing.current.source === "local") {
            audioRef.current.pause();
        } else if (player.current?.pauseVideo) {
            player.current.pauseVideo();
        }
        window.api.rpc.request.setIsPlaying(false);
        localStorage.setItem("isPlayed", "0");
    };

    const loadTrack = async (source: string, id: string) => {
        if (!source || !id) return;
        playing.current = { id, source };

        window.api.rpc.request.setLoading(true);

        if (source === "local") {
            if (
                player.current &&
                typeof player.current.stopVideo === "function"
            ) {
                player.current.stopVideo();
            }

            audioRef.current.pause();
            audioRef.current.removeAttribute("src");
            audioRef.current.load();

            const streamUrl = `http://localhost:${window.location.port}/music?path=${encodeURIComponent(id)}`;

            audioRef.current = new Audio(streamUrl);
            audioRef.current.volume = volumeRef.current / 100;

            audioRef.current.addEventListener("ended", () => {
                check_eot(sleepRef.current);

                if (isRepeatRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                    setIsPlayed(true);
                    localStorage.setItem("isPlayed", "1");
                } else {
                    window.api.rpc.request.endTrack();
                }
            });

            audioRef.current.addEventListener("loadedmetadata", () => {
                if (audioRef.current.duration === Infinity) {
                    audioRef.current.currentTime = 1e101;
                    audioRef.current.ontimeupdate = () => {
                        audioRef.current.ontimeupdate = null;
                        audioRef.current.currentTime = 0;
                    };
                }
            });

            audioRef.current.load();
            window.api.rpc.request.setLoading(false);
        } else {
            const playedId = id;
            if (
                player.current &&
                typeof player.current.loadVideoById === "function"
            ) {
                audioRef.current.pause();

                player.current.loadVideoById(playedId);

                if (player.current.getVolume() !== volumeRef.current) {
                    player.current.setVolume(volumeRef.current);
                }
                window.api.rpc.request.setLoading(false);
                window.api.rpc.request.setcurrentTime(0);
            }
        }
    };

    const initializePlayer = () => {
        if (!playerContainerRef.current || (window as any).playerInstance)
            return;

        new (window as any).YT.Player(playerContainerRef.current, {
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
                    (window as any).playerInstance = event.target;

                    loadTrack(playing.current.source, playing.current.id);
                },
                onStateChange: onPlayerStateChange,
            },
        });
    };

    const onPlayerStateChange = (event: any) => {
        const state = event.data;

        if (state === YoutubePlaybackState.Playing) {
            window.api.rpc.request.setLoading(false);
            setIsPlayed(true);
            localStorage.setItem("isPlayed", "1");
            window.api.rpc.request.setIsPlaying(true);

            if (isFirstLoad.current) {
                isFirstLoad.current = false;
                event.target.pauseVideo();
                window.api.rpc.request.setIsPlaying(false);
            }
        } else if (state === YoutubePlaybackState.Paused) {
            setIsPlayed(false);
            localStorage.setItem("isPlayed", "0");
            window.api.rpc.request.setIsPlaying(false);
        } else if (state === YoutubePlaybackState.Ended) {
            if (isRepeatRef.current) {
                event.target.seekTo(0);
                event.target.playVideo();
                setIsPlayed(true);
            } else {
                window.api.rpc.request.endTrack();
            }
        }
    };

    // Setup YouTube Script Injection
    useEffect(() => {
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

        return () => {
            // Cleanup on unmount
            if (
                player.current &&
                typeof player.current.destroy === "function"
            ) {
                player.current.destroy();
            }
        };
    }, []);

    // ONE Consolidated Polling Interval (Performance Fix)
    useEffect(() => {
        const syncInterval = setInterval(() => {
            // 1. Sync settings from LocalStorage
            const storedVolume = Number(localStorage.getItem("volume") ?? 50);
            const storedIsPlayed = localStorage.getItem("isPlayed") === "1";
            const storedIsRepeat = localStorage.getItem("isRepeat") === "1";
            const storedSleep = localStorage.getItem("sleep") as SleepMode;
            const storedPlaying = JSON.parse(
                localStorage.getItem("playing") ?? "{}",
            );

            if (volumeRef.current !== storedVolume) setVolume(storedVolume);
            if (isPlayedRef.current !== storedIsPlayed)
                setIsPlayed(storedIsPlayed);
            if (isRepeatRef.current !== storedIsRepeat)
                setIsRepeat(storedIsRepeat);
            if (sleepRef.current !== storedSleep) setSleep(storedSleep);

            // 2. Sync Volume to active player
            if (
                playing.current.source === "local" &&
                audioRef.current.volume !== storedVolume / 100
            ) {
                audioRef.current.volume = storedVolume / 100;
            } else if (
                playing.current.source !== "local" &&
                player.current &&
                typeof player.current.setVolume === "function"
            ) {
                if (player.current.getVolume() !== storedVolume)
                    player.current.setVolume(storedVolume);
            }

            // 3. Track Changes
            if (
                storedPlaying.id &&
                (storedPlaying.id !== playing.current.id ||
                    storedPlaying.source !== playing.current.source)
            ) {
                loadTrack(storedPlaying.source, storedPlaying.id).then(() => {
                    if (storedIsPlayed) playCurrentTrack();
                });
            }

            const time = localStorage.getItem("seekTo")
                ? Number(localStorage.getItem("seekTo"))
                : null;
            const currentTime =
                playing.current.source === "local"
                    ? audioRef.current.currentTime
                    : player.current?.getCurrentTime?.();

            if (time !== currentTime && time !== null) {
                if (playing.current.source === "local") {
                    audioRef.current.currentTime = time;
                } else {
                    player.current.seekTo(time);
                }
                localStorage.removeItem("seekTo");
            } else if (isCurrentlyPlaying()) {
                // 4. Time syncing to IPC (only if playing)
                if (currentTime !== undefined) {
                    window.api.rpc.request.setcurrentTime(currentTime);
                    localStorage.setItem("time", String(currentTime));
                }
            }
        }, 300);

        return () => clearInterval(syncInterval);
    }, []);

    // Handle Play/Pause toggles from State
    useEffect(() => {
        const currentlyPlaying = isCurrentlyPlaying();

        if (isPlayed && !currentlyPlaying) {
            playCurrentTrack();
        } else if (!isPlayed && currentlyPlaying) {
            pauseCurrentTrack();
        }
    }, [isPlayed]);

    return (
        <div
            ref={playerContainerRef}
            className="pointer-events-none absolute -top-full -left-full"
        />
    );
}
