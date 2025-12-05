import { useState, useEffect, useRef, RefObject } from "react";
import fetch from "@/utils/fetch.ts";
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
import Slider from "../../common/Slider/index.tsx";
import backward from "./common/backward.ts";
import forward from "./common/forward.ts";
import { sleep_types } from "@/types/index.ts";
import localstorage from "@/utils/localStorage.ts";

const handleCloseTab = () => {
    try {
        window.location.href = "https://www.google.com";
    } catch {
        return "no";
    }
};

export default function ControlUI({
    audioRef,
}: {
    audioRef: RefObject<HTMLAudioElement>;
}) {
    const [played, setplayed] = useState(false);
    const [shuffle, setshuffle] = useState(
        localstorage("get", "shuffle", "disable")
    );
    const [repeat, setrepeat] = useState(
        localstorage("get", "repeat", "disable")
    );
    const [isloading, setisloading] = useState(
        localstorage("get", "play_url", { url: null })?.url
    );

    const getUrl = async (
        source: string,
        id: string,
        autoplayed: boolean = true
    ) => {
        if (id == "") {
            return;
        }

        try {
            setisloading(true);

            const data = await fetch(`/play/${source}/${id}`, "GET");
            let url = data;
            if (source === "local") {
                const audio_format = id.split(".")[id.split(".").length - 1];

                const byteCharacters = atob(url);
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

                url = blobUrl;
            }
            setplayed(false);
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load();

            audioRef.current = new Audio(url);
            audioRef.current.load();
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

            const temp = localstorage("get", "playing", {});
            navigator.mediaSession.metadata = new MediaMetadata({
                title: temp.name,
                artist: temp.artists,
                artwork: [
                    {
                        src: temp.thumbnail,
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            });
            document.title = `${temp.name} - ${temp.artists}`;

            localstorage("set", "play_url", {
                id,
                source,
            });
            setTimeout(async () => {
                if (autoplayed) {
                    setplayed(true);
                }
                setisloading(false);
            }, 500);
        } catch (error) {
            localstorage("set", "playing", {
                name: "",
                artist: "",
                thumbnail: "",
                source: "",
                id: "",
                duration: "",
            });
            localstorage("set", "play_url", {
                id: "",
                source: "",
            });
        }
    };

    useEffect(() => {
        const run = setInterval(() => {
            const data = localstorage("get", "play_url", { url: null })?.url;
            setisloading(data?.url === null ? true : false);
            setTime((audioRef.current?.currentTime as number) ?? 0);
            setduraion((audioRef.current?.duration as number) ?? 0);
            const volume = localstorage("get", "volume", 50);
            if (volume && audioRef.current) {
                audioRef.current.volume = Number(volume) / 100;
            }
            const temp = localstorage("get", "repeat", "disable");
            if (audioRef.current && repeat !== temp) {
                setrepeat(temp);
            }
        }, 100);
        return () => clearInterval(run);
    }, []);

    const [Time, setTime] = useState(() => localstorage("get", "time", 0));
    const TimeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!audioRef.current) return;
        if (played) {
            audioRef.current.play().catch(() => {
                setplayed(false);
            });
        } else {
            audioRef.current.pause();
        }
    }, [played]);

    const [duration, setduraion] = useState(0);

    useEffect(() => {
        async function run() {
            const { id, source } = localstorage("get", "playing", {});

            if (!id) {
                return;
            }
            await getUrl(source, id, false);
        }
        run();
    }, []);

    useEffect(() => {
        const run = setInterval(() => {
            async function check() {
                const playing = localstorage("get", "playing", {});
                const now_playing = localstorage("get", "play_url", {
                    url: null,
                    id: null,
                    source: null,
                });
                if (
                    now_playing.id !== playing.id ||
                    now_playing.source !== playing.source
                ) {
                    now_playing.id = playing.id;
                    now_playing.source = playing.source;
                    now_playing.url = null;
                    localstorage("set", "play_url", now_playing);

                    await getUrl(playing.source, playing.id, true);
                }
            }
            check();
        }, 500);
        return () => clearInterval(run);
    }, []);

    useEffect(() => {
        if (TimeSliderRef.current) {
            const min = Number(TimeSliderRef?.current?.min);
            const max = Number(TimeSliderRef?.current?.max);
            const percent = ((Time - min) / (max - min)) * 100;
            TimeSliderRef.current.style.setProperty(
                "--value-percent",
                `${percent}%`
            );
        }
    }, [Time]);

    const check_eot = (temp: sleep_types) => {
        if (temp === sleep_types.eot && audioRef.current?.ended) {
            localstorage("set", "kill time", sleep_types.no);
            const temp = handleCloseTab();
            if (temp === "no") {
                audioRef.current?.pause();
                alert(
                    "I can't close this tab by script. Please close it by yourself."
                );
            }
        }
    };

    useEffect(() => {
        const run = window.setInterval(() => {
            const temp = localstorage("get", "kill time", sleep_types.no);
            check_eot(temp as sleep_types);
            if (temp === sleep_types.no) {
                return;
            }
            const kill = Number(temp as string);
            const now = new Date().getTime();
            if (now >= (kill as number)) {
                const temp = handleCloseTab();
                if (temp === "no") {
                    audioRef.current?.pause();
                    alert(
                        "We can't close this tab without open by script, so you need to close it."
                    );
                }
            }
        }, 500);
        return () => window.clearInterval(run);
    }, []);

    useEffect(() => {
        const run = window.setInterval(() => {
            async function run() {
                if (!audioRef.current) return;

                const repeat = localstorage("get", "repeat", "disable");

                if (repeat === "one" && audioRef.current.ended) {
                    const temp = localstorage(
                        "get",
                        "kill time",
                        sleep_types.no
                    );
                    check_eot(temp as sleep_types);

                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(() => setplayed(false));
                    setplayed(true);
                    setTime(0);
                } else if (audioRef.current.ended) {
                    const temp = localstorage(
                        "get",
                        "kill time",
                        sleep_types.no
                    );
                    check_eot(temp as sleep_types);

                    audioRef.current.currentTime = 0;
                    return await forward(getUrl);
                }
            }
            run();
        }, 100);
        return () => window.clearInterval(run);
    }, []);

    useEffect(() => {
        navigator.mediaSession.setActionHandler("play", () => {
            setplayed(true);
        });
        navigator.mediaSession.setActionHandler("pause", () => {
            setplayed(false);
        });
        navigator.mediaSession.setActionHandler("nexttrack", () => {
            forward(getUrl);
        });
        navigator.mediaSession.setActionHandler("previoustrack", () => {
            backward();
        });

        return () => {
            navigator.mediaSession.setActionHandler("play", () => {});
            navigator.mediaSession.setActionHandler("pause", () => {});
            navigator.mediaSession.setActionHandler("nexttrack", () => {});
            navigator.mediaSession.setActionHandler("previoustrack", () => {});
        };
    }, []);

    return (
        <div className="flex flex-col items-center">
            <div
                className={`controls flex flex-row gap-2.5 ${
                    isloading ? "opacity-50 pointer-events-none" : ""
                }`}
            >
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
                <button
                    className={`mx-0.5 p-0.5 cursor-default select-none ${
                        localstorage("get", "playedsongs", []).length === 0
                            ? "opacity-50 pointer-events-none"
                            : ""
                    }`}
                    onClick={() => {
                        backward();
                    }}
                >
                    <FontAwesomeIcon icon={faStepBackward} />
                </button>
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none"
                    onClick={() => {
                        setplayed(!played);
                    }}
                >
                    <FontAwesomeIcon icon={played ? faPause : faPlay} />
                </button>
                <button
                    className="mx-0.5 p-0.5 cursor-default select-none"
                    onClick={async () => {
                        localstorage("set", "play", []);
                        await forward(getUrl);
                    }}
                >
                    <FontAwesomeIcon icon={faStepForward} />
                </button>
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
            <div className="player flex flex-row items-center ">
                <span className="mr-[5px] cursor-default select-none text-xs">
                    {duration !== 0
                        ? `${
                              audioRef.current?.currentTime
                                  ? formatDuration(Time)
                                  : formatDuration(
                                        audioRef.current?.currentTime
                                    )
                          } / ${formatDuration(duration)}`
                        : `Loading`}
                </span>

                <Slider
                    name={"time"}
                    width={"800"}
                    reff={TimeSliderRef}
                    value={Time}
                    Change={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const newTime = Number(e.target.value);

                        if (audioRef.current) {
                            audioRef.current.currentTime = newTime;
                        }
                    }}
                    max={(audioRef.current?.duration as number) || 800}
                />
            </div>
        </div>
    );
}
