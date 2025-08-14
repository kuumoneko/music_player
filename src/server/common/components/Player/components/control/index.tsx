import { useState, useEffect, useRef, MutableRefObject } from "react";
import { fetch_data, Data } from "../../../../utils/fetch.ts";
import { sleep_types } from "../../common/types/index.ts";
import { faShuffle, faStepBackward, faPause, faPlay, faStepForward, faRepeat } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import formatDuration from "../../../../utils/format.ts";
import Slider from "../../common/Slider";
import backward from "./common/backward.ts";
import forward from "./common/forward.ts";

const handleCloseTab = () => {
    try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send("app-close");
    }
    catch {
        try {
            window.location.href = 'https://www.google.com';
        }
        catch {
            return "no";
        }
    }
};

export const getUrl = async (
    source: string,
    id: string,
    autoplayed: boolean = true,
    audioRef: MutableRefObject<HTMLAudioElement>,
    setplayed: (a: boolean) => void,
    setisloading: (a: boolean) => void,
    setduraion: (a: number) => void
) => {

    if (id == "") { return }

    try {
        setisloading(true)

        const data = await fetch_data(Data.stream, { where: source, mode: "track", id: id });
        if (source === "local") {
            const audio_format = localStorage.getItem("preferredAudioFormat");
            const array = new Int8Array(data.url);
            const buffer = array.buffer;
            const blob = new Blob([buffer], { type: `audio/${audio_format}` });
            if (blob.size > 0) {
                data.url = URL.createObjectURL(blob)
            }
        }
        setplayed(false)
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();

        audioRef.current = new Audio(data.url);
        audioRef.current.load();
        audioRef.current.addEventListener('loadedmetadata', () => {
            setduraion(audioRef.current.duration)
        });

        localStorage.setItem("play_url", JSON.stringify({
            id: id,
            source: source,
            url: data.url,
        }));
        setTimeout(async () => {
            if (autoplayed) {
                setplayed(true)
            }
            setisloading(false)
        }, 500)
    } catch (error) {
        console.error(error);
        localStorage.setItem("playing", JSON.stringify({
            name: "",
            artists: "",
            thumbnail: "",
            source: "",
            id: "",
            duration: "",
        }))
        localStorage.setItem("play_url", JSON.stringify({
            id: "",
            source: "",
            url: null,
        }));
    }
}

export default function ControlUI() {
    const [played, setplayed] = useState(false);
    const [shuffle, setshuffle] = useState(localStorage.getItem("shuffle") || "disable");
    const [repeat, setrepeat] = useState(localStorage.getItem("repeat") || "disable");
    const [isloading, setisloading] = useState(JSON.parse(localStorage.getItem("play_url") as string).url || null)

    useEffect(() => {
        const run = setInterval(() => {
            const data = JSON.parse(localStorage.getItem("play_url") as string)
            setisloading(data.url === null ? true : false)

            const volume: number = Number(localStorage.getItem("volume")) || 50;
            if (audioRef.current) {
                audioRef.current.volume = volume / 100;
            }
            setTime(audioRef.current?.currentTime as number || 0)

        }, 100);
        return () => clearInterval(run)
    }, [])

    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const [Time, setTime] = useState(() => Number(localStorage.getItem("time") || 0));
    const TimeSliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!audioRef.current) return;
        if (played) {
            audioRef.current.play().catch(e => {
                console.error("Error playing audio:", e);
                setplayed(false);
            });
        } else {
            audioRef.current.pause();
        }
    }, [played]);

    const [duration, setduraion] = useState(0);

    useEffect(() => {
        async function run() {
            const { id, source } = JSON.parse(localStorage.getItem("playing") as string || "{}")
            if (!id) {
                return;
            }
            await getUrl(source, id, false, audioRef, setplayed, setisloading, setduraion);
        }
        run();
    }, [])


    useEffect(() => {
        const run = setInterval(() => {
            async function check() {
                const playing = JSON.parse(localStorage.getItem("playing") || "{}");
                const now_playing = JSON.parse(localStorage.getItem("play_url") || "{}");
                if (now_playing.id !== playing.id || now_playing.source !== playing.source) {

                    now_playing.id = playing.id;
                    now_playing.source = playing.source;
                    now_playing.url = null;
                    localStorage.setItem("play_url", JSON.stringify({
                        id: playing.id,
                        source: playing.source,
                        url: null
                    }));
                    await getUrl(playing.source, playing.id, true, audioRef, setplayed, setisloading, setduraion);
                }
            }
            check();
        }, 500);
        return () => clearInterval(run)
    }, [])

    useEffect(() => {
        if (TimeSliderRef.current) {
            const min = Number(TimeSliderRef?.current?.min);
            const max = Number(TimeSliderRef?.current?.max);
            const percent = ((Time - min) / (max - min)) * 100;
            TimeSliderRef.current.style.setProperty('--value-percent', `${percent}%`);
        }
    }, [Time]);

    const check_eot = (temp: sleep_types) => {
        if (temp === sleep_types.eot && audioRef.current?.ended) {
            localStorage.setItem("kill time", sleep_types.no)
            const temp = handleCloseTab()
            if (temp === "no") {
                audioRef.current?.pause();
                alert("I can't close this tab by script. Please close it by yourself.")
            }
        }
    }

    useEffect(() => {
        const run = window.setInterval(() => {
            const temp = localStorage.getItem("kill time");
            check_eot(temp as sleep_types)
            if (temp === sleep_types.no) {
                return;
            }
            const kill = Number(temp as string);
            const now = new Date().getTime()
            if (now >= (kill as number)) {
                const temp = handleCloseTab()
                if (temp === "no") {
                    audioRef.current?.pause();
                    alert("We can't close this tab without open by script, so you need to close it.")
                }
            }
        }, 500);
        return () => window.clearInterval(run);
    }, [])

    useEffect(() => {
        const run = window.setInterval(() => {
            async function run() {
                if (!audioRef.current) return;

                const repeat = localStorage.getItem("repeat")

                if ((repeat === "one" && audioRef.current.ended)) {
                    const temp = localStorage.getItem("kill time");
                    check_eot(temp as sleep_types)

                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.error("Error playing audio:", e));
                    setplayed(true)
                    setTime(0)
                }
                else if (audioRef.current.ended) {
                    const temp = localStorage.getItem("kill time");
                    check_eot(temp as sleep_types)

                    audioRef.current.currentTime = 0;
                    return await forward(audioRef, setplayed, setisloading, setduraion);
                }
            }
            run()

        }, 100);
        return () => window.clearInterval(run);
    }, [])

    useEffect(() => {
        const run = setInterval(() => {
            if (audioRef.current) {
                const state = !audioRef.current.paused
                if (state !== played) {
                    setplayed(state)
                }
            }
        }, 500);
        return () => clearInterval(run)
    }, [])


    return (
        <div className='flex flex-col items-center'>
            <div className={`controls flex flex-row gap-[10px] ${isloading ? 'opacity-50 pointer-events-none' : ''}`}>
                <button className='mx-[2px] p-[2px] cursor-default select-none' onClick={() => {
                    const new_shuffle = (shuffle === "disable") ? "enable" : "disable";
                    setshuffle(new_shuffle)
                    localStorage.setItem("shuffle", new_shuffle)
                }}>
                    <FontAwesomeIcon icon={faShuffle} className={shuffle === "disable" ? "" : "text-red-500"} />
                </button>
                <button className={`mx-[2px] p-[2px] cursor-default select-none ${JSON.parse(localStorage.getItem("playedsongs") || "[]").length === 0 ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => {
                    backward();
                }}>
                    <FontAwesomeIcon icon={faStepBackward} />
                </button>
                <button className='mx-[2px] p-[2px] cursor-default select-none' onClick={() => {
                    setplayed(!played);
                }}>
                    <FontAwesomeIcon icon={played ? faPause : faPlay} />
                </button>
                <button className='mx-[2px] p-[2px] cursor-default select-none' onClick={async () => {
                    localStorage.setItem("play queue", "[]")
                    await forward(audioRef, setplayed, setisloading, setduraion);
                }}>
                    <FontAwesomeIcon icon={faStepForward} />
                </button>
                <button className='relative mx-[2px] p-[2px] cursor-default select-none' onClick={() => {
                    const new_repeat = (repeat === "disable") ? "enable" : (repeat === "enable") ? "one" : "disable";
                    setrepeat(new_repeat);
                    localStorage.setItem("repeat", new_repeat)
                }}>
                    <FontAwesomeIcon icon={faRepeat} className={(repeat === "enable" ? "text-red-500" : (repeat === "one") ? "text-green-500" : "")} />
                    {
                        repeat === "one" && (
                            <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold pointer-events-none">
                                1
                            </span>
                        )
                    }
                </button>
            </div>
            <div className="player flex flex-row items-center ">
                <span className='mr-[5px] cursor-default select-none text-xs'>
                    {
                        (duration !== 0) ? `${(audioRef.current?.currentTime) ? formatDuration(Time) : formatDuration(audioRef.current?.currentTime)} / ${formatDuration(duration)}` :
                            `Loading`
                    }
                </span>

                <Slider name={"time"} width={"800"} reff={TimeSliderRef} value={Time} Change={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const newTime = Number(e.target.value);

                    if (audioRef.current) {
                        audioRef.current.currentTime = newTime;
                    }
                }} max={audioRef.current?.duration as number || 800}
                />
            </div>
        </div>
    )
}