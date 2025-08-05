import { useState, useEffect, useRef } from "react";
import { add_items } from "../../../../utils/add_items.ts";
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
        const api = window.electronAPI;
        if (api) {
            api.close();
        }
    }
    catch {
        return "no";
    }
};

export default function PlayerUI() {
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

    const getUrl = async (source: string, id: string) => {

        if (id == "") { return }

        try {
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

            localStorage.setItem("play_url", JSON.stringify({
                id: id,
                source: source,
                url: data.url,
            }));
            setTimeout(async () => {
                // await audioRef.current.play()
                setplayed(true)
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

    useEffect(() => {
        async function run() {
            const { id, source } = JSON.parse(localStorage.getItem("playing") as string || "{}")
            if (!id) {
                return;
            }
            await getUrl(source, id);
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
                    await getUrl(playing.source, playing.id);
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


    useEffect(() => {
        const run = window.setInterval(() => {
            const temp = localStorage.getItem("kill time");
            if (temp === sleep_types.eot && audioRef.current?.ended) {
                localStorage.setItem("kill time", sleep_types.no)
                const temp = handleCloseTab()
                if (temp === "no") {
                    audioRef.current?.pause();
                    alert("We can't close this tab without open by script, so you need to close it.")
                }
            }
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
        }, 1000);
        return () => window.clearInterval(run);
    }, [])

    useEffect(() => {
        const run = window.setInterval(() => {
            if (!audioRef.current) return;

            const repeat = localStorage.getItem("repeat")
            if (repeat === "one" && audioRef.current.ended) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error("Error playing audio:", e));
                setplayed(true)
                setTime(0)
            }
            // the queue has the prior than the nextfrom :>
            else if (audioRef.current.ended && Time !== 0) {
                setplayed(false)
                let playQueue = JSON.parse(localStorage.getItem("play queue") || "[]");
                let nextfrom = JSON.parse(localStorage.getItem("nextfrom") || "{}");

                let playedsongs = JSON.parse(localStorage.getItem("playedsongs") || "[]");
                const playing = JSON.parse(localStorage.getItem("playing") as string);
                playedsongs.push({
                    artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
                    duration: playing.duration,
                    id: playing.id,
                    name: playing.name,
                    source: playing.source,
                    thumbnail: playing.thumbnail,
                })
                localStorage.setItem("playedsongs", JSON.stringify(playedsongs));
                playedsongs.push({
                    artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
                    duration: playing.duration,
                    id: playing.id,
                    name: playing.name,
                    source: playing.source,
                    thumbnail: playing.thumbnail,
                })
                localStorage.setItem("playedsongs", JSON.stringify(playedsongs));

                if (playQueue && playQueue.length > 0) {
                    const nextTrack = playQueue[0];

                    localStorage.setItem("playing", JSON.stringify({
                        artists: typeof nextTrack.artists === "string" ? nextTrack.artists : nextTrack.artists.map((artist: any) => artist.name).join(", "),
                        duration: nextTrack.duration,
                        id: nextTrack.id,
                        name: nextTrack.name,
                        source: nextTrack.source,
                        thumbnail: nextTrack.thumbnail,
                    }));
                    playQueue = playQueue.slice(1);
                    localStorage.setItem("play queue", JSON.stringify(playQueue));
                }
                else if (nextfrom.from !== "") {
                    const tracks = nextfrom.tracks;
                    const [source, mode, id] = nextfrom.from.split(":");
                    const track = tracks[0];
                    if (mode == "track") {
                        localStorage.setItem("playing", JSON.stringify({
                            artists: typeof track.artists === "string" ? track.artists : track.artists.map((artist: any) => artist.name).join(", "),
                            duration: track.track.duration,
                            id: track.track.id,
                            name: track.track.name,
                            source: source,
                            thumbnail: track.thumbnail,
                        }));
                    }
                    else {
                        tracks.shift();
                        add_items(source, mode, id, tracks)
                        console.log(track)
                        localStorage.setItem("playing", JSON.stringify({
                            artists: typeof track.artists === "string" ? track.artists : track.artists.map((artist: any) => artist.name).join(", "),
                            duration: track.duration,
                            id: track.id,
                            name: track.name,
                            source: source,
                            thumbnail: track.thumbnail,
                        }));
                    }
                }
            }
        }, 100);
        return () => window.clearInterval(run);
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
                <button className='mx-[2px] p-[2px] cursor-default select-none' onClick={() => {
                    forward()
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
                <span className='mr-[5px] cursor-default select-none'>
                    {audioRef.current?.duration
                        ? `${formatDuration(audioRef.current?.currentTime || 0)} / ${formatDuration(
                            audioRef.current?.duration || 0
                        )}`
                        : 'Loading...'}
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