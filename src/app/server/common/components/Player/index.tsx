// src/components/Player.tsx
import { useEffect, useState, useRef, RefObject } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBed, faDatabase, faPause, faPlay, faRepeat, faShuffle, faStepBackward, faStepForward } from '@fortawesome/free-solid-svg-icons';
import formatDuration from '../../utils/format.ts';
import { goto } from '../../utils/url.ts';
import { Data, fetch_data } from '../../utils/fetch.ts';
import { add_items } from '../../utils/add_items.ts';

export default function Player({
    url, seturl
}: { url: string, seturl: (a: string) => void }) {
    const playing = JSON.parse(localStorage.getItem("playing") as string) || {
        id: "",
        name: "",
        artists: "",
        thumbnail: "",
        source: "",
        duration: "",
    }

    const [id, setid] = useState<any>(playing.id);
    const [name, setname] = useState<any>(playing.name);
    const [artists, setartists] = useState<any>(playing.artists);
    const [thumbnail, setthumbnail] = useState<any>(playing.thumbnail);
    const [source, setsource] = useState<any>(playing.source);


    const [played, setplayed] = useState(false);
    // Use a function for initial state to read from localStorage only once. Default to 50.
    const [volume, setvolume] = useState(() => Number(localStorage.getItem("volume") || 50));
    const volumeSliderRef = useRef<HTMLInputElement>(null);

    const [Time, setTime] = useState(() => Number(localStorage.getItem("time") || 0));
    const TimeSliderRef = useRef<HTMLInputElement>(null);

    const [shuffle, setshuffle] = useState(localStorage.getItem("shuffle") || "disable");
    const [repeat, setrepeat] = useState(localStorage.getItem("repeat") || "disable");

    const [audioUrl, setAudioUrl] = useState<any>(JSON.parse(localStorage.getItem("play_url") as string).url || null);
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);


    enum sleep_types {
        no = "nosleep",
        five = "after 5 minutes",
        ten = "after 10 minutes",
        tenfive = "after 15 minutes",
        threeten = "after 30 minutes",
        fourfive = "after 45 minutes",
        hour = "after 1 hours",
        eot = "end of this track"
    }

    const sleep_type = ["nosleep", "after 5 minutes", "after 10 minutes", "after 15 minutes", "after 30 minutes", "after 45 minutes", "after 1 hours", "end of this track"];
    const [sleep, setsleep] = useState(sleep_types.no);
    // const [sleep_time, setsleep_time] = useState<string | number>(sleep_types.no)


    useEffect(() => {
        const run = window.setInterval(() => {
            setTime(audioRef.current?.currentTime || Number(localStorage.getItem("time")));
            setrepeat(localStorage.getItem("repeat") as string || "disable");
            setvolume(Number(localStorage.getItem("volume") || 50));
        }, 1000);

        return () => window.clearInterval(run);
    }, [])

    useEffect(() => {
        const run = window.setInterval(() => {
            async function run() {

                const data = JSON.parse(localStorage.getItem("playing") as string);
                const check = JSON.parse(localStorage.getItem("play_url") as string);
                setname(data.name);
                setartists(data.artists);
                setthumbnail(data.thumbnail);
                setid(data.id);
                setsource(data.source);

                if (check.id !== data.id || check.source !== data.source) {
                    // setsleep(sleep_types.no)
                    await getUrl(data.source, data.id);
                }
            }
            run();
        }, 1000);
        return () => window.clearInterval(run);
    }, [])

    // This effect syncs the slider's visual fill with its value.
    useEffect(() => {
        if (volumeSliderRef.current) {
            const min = Number(volumeSliderRef.current.min);
            const max = Number(volumeSliderRef.current.max);
            // Calculate the percentage of the value
            const percent = ((volume - min) / (max - min)) * 100;
            // Set a CSS custom property on the slider element, which the CSS gradient will use
            volumeSliderRef.current.style.setProperty('--value-percent', `${percent}%`);
        }
    }, [volume]); // Rerun whenever volume changes

    // This effect syncs the slider's visual fill with its value.
    useEffect(() => {
        if (TimeSliderRef.current) {
            const min = Number(TimeSliderRef?.current?.min);
            const max = Number(TimeSliderRef?.current?.max);
            const percent = ((Time - min) / (max - min)) * 100;
            TimeSliderRef.current.style.setProperty('--value-percent', `${percent}%`);
        }
    }, [Time]); // Rerun whenever volume changes

    const OnClick = (source: string, id: string) => {
        goto(`/track/${source}/${id}`, seturl)
    }


    const getUrl = async (source: string, id: string) => {
        setIsLoading(true);

        if (id == "") { return }

        try {
            // Fetch the stream URL from your backend
            const data = await fetch_data(Data.stream, { where: source, mode: "track", id: id })

            if (source === "local") {
                const mimeType = "audio/m4a"
                const binary = atob(data.url);
                const len = binary.length;
                const buffer = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    buffer[i] = binary.charCodeAt(i);
                }

                // Create a Blob and object URL
                const blob = new Blob([buffer], { type: mimeType });
                data.url = URL.createObjectURL(blob);
            }
            setAudioUrl(data.url);
            setplayed(false);
            localStorage.setItem("play_url", JSON.stringify({
                id: id,
                source: source,
                url: data.url,
            }));
            setTimeout(() => {
                setplayed(true)
            }, 500);
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
                url: "",
            }));
        } finally {
            setIsLoading(false);
        }
    }


    useEffect(() => {
        async function run() {
            if (!id) {
                return;
            }
            await getUrl(source, id);
        }
        run();
    }, [])


    useEffect(() => {
        const run = window.setInterval(() => {
            const state = audioRef.current ? !audioRef.current.paused : false;
            if (state !== played) {
                setplayed(state);
            }
        }, 100);
        return () => window.clearInterval(run);
    }, [])

    const handleCloseTab = () => {
        try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send("app-close");
        }
        catch {
            setplayed(false)
            alert("We can't close this tab without open by script, so you need to close it.")
        }
    };

    useEffect(() => {
        const run = window.setInterval(() => {
            const temp = localStorage.getItem("kill time");

            if (temp === sleep_types.eot && audioRef.current?.ended) {
                return handleCloseTab();
            }


            if (temp === sleep_types.no) {
                return;
            }

            const kill = Number(temp as string);

            const now = new Date().getTime();

            console.log(now, ' ', kill)

            if (now >= (kill as number)) {
                return handleCloseTab();
            }

        }, 1000);
        return () => window.clearInterval(run);
    }, [])


    // This effect handles playing and pausing the audio.
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

    useEffect(() => {

        let kill_time: string | number = new Date().getTime();

        switch (sleep) {
            case sleep_types.no:
                kill_time = sleep_types.no
                break;
            case sleep_types.five:
                kill_time += 30 * 1000
                break;
            case sleep_types.ten:
                kill_time += 10 * 60 * 1000
                break;
            case sleep_types.tenfive:
                kill_time += 15 * 60 * 1000
                break;
            case sleep_types.threeten:
                kill_time += 30 * 60 * 1000
                break;
            case sleep_types.fourfive:
                kill_time += 45 * 60 * 1000
                break;
            case sleep_types.hour:
                kill_time += 60 * 60 * 1000
                break;
            default:
                kill_time = "end of this track"
        }
        // setsleep_time(kill_time)
        localStorage.setItem("kill time", typeof kill_time === 'string' ? kill_time : String(kill_time));

    }, [sleep])


    useEffect(() => {
        const run = window.setInterval(() => {
            if (!audioRef.current) return;
            const repeat = localStorage.getItem("repeat")
            // console.log(repeat, ' ', audioRef.current?.ended);
            if (repeat === "one" && audioRef.current.ended) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error("Error playing audio:", e));
                setplayed(true)
                setTime(0)
            }
            else if (audioRef.current.ended && Time !== 0) {


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


                audioRef.current.currentTime = 0;
                setTime(0);
                setplayed(false)
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
                    const nextTrack = playQueue[0];  // Play the first track

                    localStorage.setItem("playing", JSON.stringify({
                        artists: typeof nextTrack.artists === "string" ? nextTrack.artists : nextTrack.artists.map((artist: any) => artist.name).join(", "),
                        duration: nextTrack.duration,
                        id: nextTrack.id,
                        name: nextTrack.name,
                        source: nextTrack.source,
                        thumbnail: nextTrack.thumbnail,
                    }));

                    playQueue = playQueue.slice(1);  // Remove the played track from the queue
                    localStorage.setItem("play queue", JSON.stringify(playQueue));


                    return getUrl(nextTrack.source, nextTrack.id).then(() => {
                        if (audioRef.current) {
                            audioRef.current.play().catch(e => console.error("Error playing next track:", e));
                        }
                    });
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
                        // setTime(0);
                    }
                    else {
                        const tracks = nextfrom.tracks;
                        tracks.shift();

                        add_items(source, mode, id, tracks)


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


    // This effect syncs the audio element's volume with the volume state.
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume / 100;
        }
    }, [volume]);


    const Sleep_comp = () => {
        switch (sleep) {
            case sleep_types.no:
                return <span className="w-[100%] flex flex-row-reverse">none</span>;
            case sleep_types.five:
                return <span className="w-[100%] flex flex-row-reverse">5</span>;
            case sleep_types.ten:
                return <span className="w-[100%] flex flex-row-reverse">10</span>;
            case sleep_types.tenfive:
                return <span className="w-[100%] flex flex-row-reverse">15</span>;
            case sleep_types.threeten:
                return <span className="w-[100%] flex flex-row-reverse">30</span>;
            case sleep_types.fourfive:
                return <span className="w-[100%] flex flex-row-reverse">45</span>;
            case sleep_types.hour:
                return <span className="w-[100%] flex flex-row-reverse">1 hour</span>;
            default:
                return <span className="w-[100%] flex flex-row-reverse">End</span>;
        }
    }

    useEffect(() => {
        async function run() {
            if (shuffle === "enable") {

            }
        }
    }, [shuffle]);


    return (
        <div className="player h-[35%] w-[90%] bg-slate-200 dark:bg-slate-700 text-black dark:text-white mt-[15px] rounded-xl flex justify-between items-center px-[5px] m-0 select-none" >
            <div className='flex flex-row items-center ml-[15px]'>
                <span>
                    {
                        thumbnail ? (
                            <img src={thumbnail as string} alt="" height={75} width={75} className="rounded-lg" />

                        ) : (
                            <>

                            </>
                        )
                    }
                </span>


                {/* <img src={thumbnail} height={50} width={50} /> */}
                <div className="currently-playing ml-[5px] cursor-default select-none flex flex-col">
                    {
                        (id !== "") && (
                            <span className='text-sm hover:underline hover:cursor-pointer' onClick={() => { OnClick(source, id) }}>
                                {
                                    name?.slice(0, 30)
                                }
                            </span>
                        )
                    }
                    {
                        (artists !== "") && (
                            <span className='text-sm'>
                                {
                                    artists
                                }
                            </span>
                        )
                    }
                </div>
            </div>

            <div className='flex flex-col items-center'>
                <div className={`controls flex flex-row gap-[10px] ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button className='mx-[2px] p-[2px] cursor-default select-none' onClick={() => {
                        const new_shuffle = (shuffle === "disable") ? "enable" : "disable";
                        setshuffle(new_shuffle)
                        localStorage.setItem("shuffle", new_shuffle)
                    }}>
                        <FontAwesomeIcon icon={faShuffle} className={shuffle === "disable" ? "" : "text-red-500"} />
                    </button>
                    <button className={`mx-[2px] p-[2px] cursor-default select-none ${JSON.parse(localStorage.getItem("playedsongs") || "[]").length === 0 ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => {
                        let playedsongs: any[] = JSON.parse(localStorage.getItem("playedsongs") || "[]");
                        const playing = JSON.parse(localStorage.getItem("playing") as string);
                        const queue = JSON.parse(localStorage.getItem("play queue") as string);
                        const backward = playedsongs.pop();

                        localStorage.setItem("playing", JSON.stringify({
                            artists: typeof backward.artists === "string" ? backward.artists : backward.artists.map((artist: any) => artist.name).join(", "),
                            duration: backward.duration,
                            id: backward.id,
                            name: backward.name,
                            source: backward.source,
                            thumbnail: backward.thumbnail,
                        }))

                        localStorage.setItem("playedsongs", JSON.stringify(playedsongs))

                        localStorage.setItem("play queue", JSON.stringify([
                            {
                                artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
                                duration: playing.duration,
                                id: playing.id,
                                name: playing.name,
                                source: playing.source,
                                thumbnail: playing.thumbnail,
                            },
                            ...queue
                        ]));
                    }}>
                        <FontAwesomeIcon icon={faStepBackward} />
                    </button>
                    <button className='mx-[2px] p-[2px] cursor-default select-none' onClick={() => { setplayed(!played); }}>
                        <FontAwesomeIcon icon={played ? faPause : faPlay} />
                    </button>
                    <button className='mx-[2px] p-[2px] cursor-default select-none' onClick={() => {
                        let playedsongs: any[] = JSON.parse(localStorage.getItem("playedsongs") || "[]");
                        const playing = JSON.parse(localStorage.getItem("playing") as string);
                        let playQueue = JSON.parse(localStorage.getItem("play queue") as string);
                        const nextfrom = JSON.parse(localStorage.getItem("nextfrom") as string);

                        (audioRef.current as any).currentTime = 0;
                        setTime(0);
                        setplayed(false)

                        playedsongs.push({
                            artists: typeof playing.artists === "string" ? playing.artists : playing.artists.map((artist: any) => artist.name).join(", "),
                            duration: playing.duration,
                            id: playing.id,
                            name: playing.name,
                            source: playing.source,
                            thumbnail: playing.thumbnail,
                        })

                        const uniqueObjectList = Array.from(new Map(playedsongs.map((item: any) => [item.id, item])).values());


                        localStorage.setItem("playedsongs", JSON.stringify(uniqueObjectList));



                        if (playQueue && playQueue.length > 0) {
                            const nextTrack = playQueue[0];  // Play the first track

                            localStorage.setItem("playing", JSON.stringify({
                                artists: typeof nextTrack.artists === "string" ? nextTrack.artists : nextTrack.artists.map((artist: any) => artist.name).join(", "),
                                duration: nextTrack.duration,
                                id: nextTrack.id,
                                name: nextTrack.name,
                                source: nextTrack.source,
                                thumbnail: nextTrack.thumbnail,
                            }));

                            playQueue = playQueue.slice(1);  // Remove the played track from the queue
                            localStorage.setItem("play queue", JSON.stringify(playQueue));


                            return getUrl(nextTrack.source, nextTrack.id).then(() => {
                                if (audioRef.current) {
                                    audioRef.current.play().catch(e => console.error("Error playing next track:", e));
                                }
                            });
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
                                // setTime(0);
                            }
                            else {
                                const tracks: any[] = nextfrom.tracks;
                                tracks.shift();

                                add_items(source, mode, id, tracks)


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
                    <audio src={audioUrl as string} ref={audioRef} />

                    <Slider name={"time"} width={"800"} reff={TimeSliderRef} value={Time} Change={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const newTime = Number(e.target.value);
                        // console.log(newTime, ' ', audioRef.current?.currentTime)

                        if (audioRef.current) {
                            audioRef.current.currentTime = newTime;
                        }
                    }} max={audioRef.current?.duration as number || 800}
                    />
                </div>
            </div>

            <div className="volume group flex flex-row mr-[10px] cursor-pointer select-none">
                <span className='flex flex-row'>
                    <span className='w-[60px]  mr-[5px] flex flex-row-reverse'>
                        <Sleep_comp />
                    </span>
                    <span className='mr-[10px]'
                        onClick={() => {
                            const index = sleep_type.indexOf(sleep);
                            setsleep(sleep_type[(index + 1) % sleep_type.length] as sleep_types);

                        }}
                    >
                        <FontAwesomeIcon icon={faBed} />
                    </span>
                </span>

                <span className='mr-[10px]' onClick={() => {
                    goto("/queue/play", seturl)
                }}>
                    <FontAwesomeIcon icon={faDatabase} />
                </span>
                <div className='volume group flex flex-col items-center mr-[10px] cursor-pointer select-none'>
                    <Slider name={"volume"} width={"100"} reff={volumeSliderRef} value={volume} Change={(e) => {
                        const newVolume = Number(e.target.value);
                        localStorage.setItem("volume", String(newVolume));
                        setvolume(newVolume);
                    }} max={100} />
                    <span className='cursor-default'>
                        Volume: {volume}
                    </span>
                </div>
            </div>
        </div>
    );
}


function Slider({ name, width, reff, value, Change, max }: { name: string, width: number | string, reff: RefObject<HTMLInputElement>, value: number, Change: (e: React.ChangeEvent<HTMLInputElement>) => void, max: number }) {
    return (
        <input
            title={name}
            ref={reff}
            type="range"
            min="0"
            max={max}
            value={value || 0}
            style={{
                width: `${width}px`,

            }}
            className={`${name} 
                        w-[${width}px] h-[5px]
                        cursor-pointer 
                        apperance-none
                        bg-transparent 
                        
                        /* Track: We use a gradient to create the 'filled' effect. */
                        /* The '--value-percent' CSS variable is set by the useEffect hook. */
                        [&::-webkit-slider-runnable-track]:h-1 
                        [&::-webkit-slider-runnable-track]:rounded-full 
                        [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,theme(colors.red.500)_var(--value-percent),theme(colors.slate.400)_var(--value-percent))]

                        /* Thumb: Webkit */
                        [&::-webkit-slider-thumb]:appearance-none 
                        [&::-webkit-slider-thumb]:h-4 
                        [&::-webkit-slider-thumb]:w-4 
                        [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:bg-red-500 
                        /* Vertically center thumb on track */  
                        [&::-webkit-slider-thumb]:-mt-[6px] 
                        [&::-webkit-slider-thumb]:opacity-0
                        [&::-webkit-slider-thumb]:transition-opacity
                        hover:[&::-webkit-slider-thumb]:opacity-100
                        `}
            onChange={(e) => {
                Change(e);
            }}
        />
    )
}