import { useState, useEffect, useRef, MutableRefObject } from "react";
import { fetch_data, Data } from "../../../../utils/fetch.ts";
import { sleep_types } from "../../common/types/index.ts";
import {
    faShuffle,
    faStepBackward,
    faPause,
    faPlay,
    faStepForward,
    faRepeat,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import formatDuration from "../../../../utils/format.ts";
import Slider from "../../common/Slider";
import backward from "./common/backward.ts";
import forward from "./common/forward.ts";
import fetch_profile, {
    LocalStorageKeys,
} from "../../../../utils/localStorage.ts";

const handleCloseTab = () => {
    try {
        const { ipcRenderer } = window.require("electron");
        ipcRenderer.send("app-close");
    } catch {
        try {
            window.location.href = "https://www.google.com";
        } catch {
            return "no";
        }
    }
};

export default function ControlUI({
    audioRef,
}: {
    audioRef: MutableRefObject<HTMLAudioElement>;
}) {
    const [played, setplayed] = useState(false);
    const [shuffle, setshuffle] = useState(
        localStorage.getItem("shuffle") || "disable"
    );
    const [repeat, setrepeat] = useState(
        localStorage.getItem("repeat") || "disable"
    );
    const [isloading, setisloading] = useState(
        JSON.parse(localStorage.getItem("play_url") as string).url || null
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

            const data: { url: string } = await fetch_data(Data.stream, {
                where: source,
                id: id,
            });

            if (source === "local") {
                const audio_format = id.split(".")[id.split(".").length - 1];

                const byteCharacters = atob(data.url);
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

                data.url = blobUrl;
            }

            setplayed(false);
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load();

            audioRef.current = new Audio(data.url);
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

            const temp = JSON.parse(localStorage.getItem("playing") ?? "{}");
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

            localStorage.setItem(
                "play_url",
                JSON.stringify({
                    id: id,
                    source: source,
                })
            );
            setTimeout(async () => {
                if (autoplayed) {
                    setplayed(true);
                }
                setisloading(false);
            }, 500);
        } catch (error) {
            localStorage.setItem(
                "playing",
                JSON.stringify({
                    name: "",
                    artists: "",
                    thumbnail: "",
                    source: "",
                    id: "",
                    duration: "",
                })
            );
            localStorage.setItem(
                "play_url",
                JSON.stringify({
                    id: "",
                    source: "",
                })
            );
        }
    };

    useEffect(() => {
        const run = setInterval(() => {
            const data = JSON.parse(localStorage.getItem("play_url") as string);
            setisloading(data.url === null ? true : false);
            setTime((audioRef.current?.currentTime as number) ?? 0);
            setduraion((audioRef.current?.duration as number) ?? 0);
            const volume = localStorage.getItem("volume");
            if (volume && audioRef.current) {
                audioRef.current.volume = Number(volume) / 100;
            }
            const repeat = localStorage.getItem("repeat") ?? "disable";
            if (repeat && audioRef.current) {
                setrepeat(repeat);
            }
        }, 100);
        return () => clearInterval(run);
    }, []);

    const [Time, setTime] = useState(() =>
        Number(localStorage.getItem("time") ?? 0)
    );
    const TimeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!audioRef.current) return;
        if (played) {
            audioRef.current.play().catch((e) => {
                setplayed(false);
            });
        } else {
            audioRef.current.pause();
        }
    }, [played]);

    const [duration, setduraion] = useState(0);

    useEffect(() => {
        async function run() {
            const { id, source } = JSON.parse(
                (localStorage.getItem("playing") as string) || "{}"
            );
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
                const playing = JSON.parse(
                    localStorage.getItem("playing") || "{}"
                );
                const now_playing = JSON.parse(
                    localStorage.getItem("play_url") || "{}"
                );
                if (
                    now_playing.id !== playing.id ||
                    now_playing.source !== playing.source
                ) {
                    now_playing.id = playing.id;
                    now_playing.source = playing.source;
                    now_playing.url = null;
                    localStorage.setItem(
                        "play_url",
                        JSON.stringify({
                            id: playing.id,
                            source: playing.source,
                        })
                    );
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
            localStorage.setItem("kill time", sleep_types.no);
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
            const temp = localStorage.getItem("kill time");
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

                const repeat = localStorage.getItem("repeat");

                if (repeat === "one" && audioRef.current.ended) {
                    const temp = localStorage.getItem("kill time");
                    check_eot(temp as sleep_types);

                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch((e) => setplayed(false));
                    setplayed(true);
                    setTime(0);
                } else if (audioRef.current.ended) {
                    const temp = localStorage.getItem("kill time");
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
                className={`controls flex flex-row gap-[10px] ${
                    isloading ? "opacity-50 pointer-events-none" : ""
                }`}
            >
                <button
                    className="mx-[2px] p-[2px] cursor-default select-none"
                    onClick={() => {
                        const new_shuffle =
                            shuffle === "disable" ? "enable" : "disable";
                        setshuffle(new_shuffle);
                        localStorage.setItem("shuffle", new_shuffle);
                    }}
                >
                    <FontAwesomeIcon
                        icon={faShuffle}
                        className={shuffle === "disable" ? "" : "text-red-500"}
                    />
                </button>
                <button
                    className={`mx-[2px] p-[2px] cursor-default select-none ${
                        JSON.parse(localStorage.getItem("playedsongs") || "[]")
                            .length === 0
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
                    className="mx-[2px] p-[2px] cursor-default select-none"
                    onClick={() => {
                        setplayed(!played);
                    }}
                >
                    <FontAwesomeIcon icon={played ? faPause : faPlay} />
                </button>
                <button
                    className="mx-[2px] p-[2px] cursor-default select-none"
                    onClick={async () => {
                        await fetch_profile("write", LocalStorageKeys.play, []);
                        await forward(getUrl);
                    }}
                >
                    <FontAwesomeIcon icon={faStepForward} />
                </button>
                <button
                    className="relative mx-[2px] p-[2px] cursor-default select-none"
                    onClick={() => {
                        const new_repeat =
                            repeat === "disable"
                                ? "enable"
                                : repeat === "enable"
                                ? "one"
                                : "disable";
                        setrepeat(new_repeat);
                        localStorage.setItem("repeat", new_repeat);
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
