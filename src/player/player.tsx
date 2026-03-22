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
        isFirstLoad.current = false;
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

    const loadTrack = async (track: any) => {
        const { source, id, index } = track;
        if (!source || id === null || id === undefined) return;
        playing.current = { id, source };

        isPlayedRef.current = false;
        audioRef.current.pause();
        player.current?.stopVideo?.();

        localStorage.setItem("isPlayed", "0");
        window.api.rpc.request.setLoading(true);
        window.api.rpc.request.setIsPlaying(false);

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

            const streamUrl = `http://localhost:${window.location.port}/music?path=${encodeURIComponent(index)}`;

            audioRef.current = new Audio(streamUrl);
            audioRef.current.volume = volumeRef.current / 100;

            audioRef.current.addEventListener("ended", () => {
                check_eot(sleepRef.current);

                if (isRepeatRef.current) {
                    audioRef.current.currentTime = 0;
                    isPlayedRef.current = true;
                    isFirstLoad.current = false;
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
                player.current.loadVideoById(playedId);

                if (player.current.getVolume() !== volumeRef.current) {
                    player.current.setVolume(volumeRef.current);
                }
                window.api.rpc.request.setLoading(false);
                window.api.rpc.request.setcurrentTime(0);
                if (!isFirstLoad.current) {
                    isPlayedRef.current = true;
                }
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

                    loadTrack(playing.current);
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
            } else {
                event.target.playVideo();
                window.api.rpc.request.setIsPlaying(true);
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
            if (
                player.current &&
                typeof player.current.destroy === "function"
            ) {
                player.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        const syncInterval = setInterval(() => {
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

            if (
                storedPlaying.id &&
                (storedPlaying.id !== playing.current.id ||
                    storedPlaying.source !== playing.current.source)
            ) {
                loadTrack(storedPlaying).then(() => {
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
                    if (audioRef.current.readyState >= 1) {
                        audioRef.current.currentTime = time;
                        localStorage.removeItem("seekTo");
                    }
                } else {
                    if (
                        player.current &&
                        typeof player.current.seekTo === "function"
                    ) {
                        player.current.seekTo(time, true);
                        localStorage.removeItem("seekTo");
                    }
                }
            } else if (isCurrentlyPlaying()) {
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

    useEffect(() => {
        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () => {
                console.log("Global Play Triggered");
                isPlayedRef.current = true;
                localStorage.setItem("isPlayed", "1");
                audioRef.current?.play();
                window.api.rpc.request.setIsPlaying(true);

                navigator.mediaSession.playbackState = "playing";
            });

            navigator.mediaSession.setActionHandler("pause", () => {
                console.log("Global Pause Triggered");
                isPlayedRef.current = true;
                localStorage.setItem("isPlayed", "0");
                window.api.rpc.request.setIsPlaying(false);
                audioRef.current?.pause();
                navigator.mediaSession.playbackState = "paused";
            });
        }

        return () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.setActionHandler("play", null);
                navigator.mediaSession.setActionHandler("pause", null);
            }
        };
    }, []);

    return (
        <div
            ref={playerContainerRef}
            className="pointer-events-none absolute -top-full -left-full"
        />
    );
}
