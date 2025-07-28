import { faDownload, faListDots, faPlay, faShare } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Track } from "../../../../../../types/index.ts";
import formatDuration from "../../../../common/utils/format.ts";
import Loading from "../../../../common/components/Loading/index.tsx"


export function Show({ list, source, id, mode }: { list: any[], source: string, id: string, mode: string }) {

    return (
        <div className="liked_songs flex flex-col max-h-[75%] w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden">
            {
                list?.length > 0 ? (
                    <>
                        {
                            list?.map((item: Track, index: number) => {
                                return (
                                    <div key={`list ${index}`} className={`vid ${index + 1} flex h-[200px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}
                                        onDoubleClick={(e) => {
                                            localStorage.setItem("playing", JSON.stringify({
                                                name: item.track.name,
                                                artists: item.artists.map((artist: any) => artist.name).join(", "),
                                                thumbnail: item.thumbnail,
                                                source: source,
                                                id: item.track.id,
                                            }))
                                            localStorage.setItem("time", "0");
                                            localStorage.setItem("repeat", (localStorage.getItem("repeat") === "disable") ? "disable" : "enable");

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

                                            const uniqueObjectList = Array.from(new Map(playedsongs.map((item: any) => [item.id, item])).values());


                                            localStorage.setItem("playedsongs", JSON.stringify(uniqueObjectList));


                                            if (mode === "track") {
                                                localStorage.setItem("nextfrom", JSON.stringify({
                                                    from: `${source}:${mode}:${id}`,
                                                    tracks: [
                                                        {
                                                            name: item.track.name,
                                                            artists: item.artists.map((artist: any) => artist.name).join(", "),
                                                            thumbnail: item.thumbnail,
                                                            source: source,
                                                            id: item.track.id,
                                                            duration: item.track.duration
                                                        }
                                                    ]
                                                }))
                                            }
                                            else if (mode === "playlist" || mode === "liked songs" || mode === "local") {
                                                const other_tracks: any[] = list?.filter((track: any) => item.track.id !== track.track.id) || [];

                                                if (other_tracks.length > 0) {
                                                    // check the shuffle mode
                                                    const shuffle = localStorage.getItem("shuffle") as string;
                                                    if (shuffle === "enable") {
                                                        for (let i = other_tracks.length - 1; i > 0; i--) {
                                                            const j = Math.floor(Math.random() * (i + 1));
                                                            [other_tracks[i], other_tracks[j]] = [other_tracks[j], other_tracks[i]];
                                                        }
                                                    }
                                                    localStorage.setItem("nextfrom", JSON.stringify({
                                                        from: `${source}:${mode}:${id}`,
                                                        tracks: other_tracks.slice(0, 20).map((track: Track) => {
                                                            return {
                                                                name: track.track.name,
                                                                artists: track.artists.map((artist: any) => artist.name).join(", "),
                                                                thumbnail: track.thumbnail,
                                                                source: source,
                                                                id: track.track.id,
                                                                duration: item.track.duration

                                                            }
                                                        })
                                                    }))
                                                }
                                            }
                                            else if (mode === "search") {
                                                localStorage.setItem("nextfrom", JSON.stringify({
                                                    from: `${source}:${'track'}:${id}`,
                                                    tracks: [
                                                        {
                                                            name: item.track.name,
                                                            artists: item.artists.map((artist: any) => artist.name).join(", "),
                                                            thumbnail: item.thumbnail,
                                                            source: source,
                                                            id: item.track.id,
                                                            duration: item.track.duration

                                                        }
                                                    ]
                                                }))
                                            }
                                        }}
                                    >

                                        <div className="flex flex-row items-center ml-[10px]" >
                                            <span className="thumbnail cursor-default select-none" >
                                                <img src={item.thumbnail} alt="" height={100} width={100} />
                                            </span>
                                            <div className="flex flex-col ml-[10px]">
                                                <span className="title cursor-default select-none" >
                                                    {
                                                        item.track?.name || "cant load"
                                                    }
                                                </span>
                                                <span className="artists cursor-default select-none">{item.artists.map((artist: any) => artist.name).join(", ")}</span>
                                                <div className="flex flex-row items-center">
                                                    <span className="releaseDate cursor-default select-none">
                                                        {item.track?.releaseDate || "cant load"}
                                                    </span>
                                                    <span className="duration cursor-default select-none ml-[15px]">
                                                        {formatDuration(item.track?.duration as number / 1000) || "cant load"}
                                                    </span>
                                                </div>

                                            </div>
                                        </div>

                                        <div className="action_button flex flex-row-reverse mr-[10px]">
                                            <span className="mr-[10px]" onClick={() => {
                                                if (source === "youtube") {
                                                    const url = "https://www.youtube.com/watch?v=" + item.track.id;
                                                    navigator.clipboard.writeText(url);
                                                }
                                                else {
                                                    const url = "https://open.spotify.com/track/" + item.track.id;
                                                    navigator.clipboard.writeText(url);
                                                }
                                            }}>
                                                <FontAwesomeIcon icon={faShare} />
                                            </span>
                                            <span className="mr-[10px]" onClick={() => {
                                                const queue = JSON.parse(localStorage.getItem("play queue") as string) || [];
                                                queue.push({
                                                    name: item.track.name,
                                                    artists: item.artists.map((artist: any) => artist.name).join(", "),
                                                    thumbnail: item.thumbnail,
                                                    source: source,
                                                    id: item.track.id,
                                                    duration: item.track.duration,
                                                    time: 0,

                                                })
                                                localStorage.setItem("play queue", JSON.stringify(queue));

                                            }}>
                                                <FontAwesomeIcon icon={faListDots} />
                                            </span>
                                            <span className={`mr-[10px] ${mode === "local" ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => {
                                                
                                                const queue = JSON.parse(localStorage.getItem("download queue") as string) || [];
                                                queue.push({
                                                    name: item.track.name,
                                                    mode: "track",
                                                    source: source,
                                                    id: item.track.id,
                                                })
                                                localStorage.setItem("download queue", JSON.stringify(queue));
                                            }}

                                            >
                                                <FontAwesomeIcon icon={faDownload} />
                                            </span>

                                        </div>
                                    </div>
                                )
                            })
                        }
                    </>
                ) : (
                    <Loading mode={"Loading data"} />
                )
            }
        </div>
    )
}

export function Showw({ name, thumbnail, duration, releaseDate, artists, source, id, mode, playlist }: { name: string | null, thumbnail: string | null, duration: number | null, releaseDate?: string, artists?: any[], source: string, id: string, mode: string, playlist?: any[] }) {

    return (
        <>
            {
                (name !== null && duration !== null) ? (
                    <div className="flex flex-col mt-[50px] w-[90%] mb-[15px]">
                        <div className="flex flex-row items-center select-none cursor-default">
                            <span>
                                {
                                    thumbnail ? (
                                        <img src={thumbnail as string} alt="" height={150} width={150} className="rounded-lg" />

                                    ) : (
                                        <>

                                        </>
                                    )
                                }
                            </span>

                            <div className="flex flex-col ml-[20px]">
                                <span className="text-2xl font-bold">{name}</span>
                                <span className="text-lg text-gray-500">{artists?.map((artist: any) => artist.name).join(", ")}</span>
                                <div className="flex flex-row items-center">
                                    <span className="releaseDate cursor-default select-none">
                                        {releaseDate}
                                    </span>
                                    <span className="duration cursor-default select-none ml-[15px]">
                                        {formatDuration(duration / 1000 as number)}
                                    </span>
                                </div>
                                <div className="flex flex-row items-center">
                                    <span onClick={() => {
                                        if (mode === "track") {
                                            localStorage.setItem("playing", JSON.stringify({
                                                name: name,
                                                artists: artists?.map((artist: any) => artist.name).join(", "),
                                                thumbnail: thumbnail,
                                                source: source,
                                                id: id,
                                                // duration: duration,
                                            }))
                                            localStorage.setItem("time", "0")

                                        }
                                        else {

                                            const check = JSON.parse(localStorage.getItem("playing") as string);
                                            if (check.playlist === name) {
                                                return;
                                            }

                                            const max = playlist?.length as number - 1,
                                                min = 0;
                                            const random = Math.floor(Math.random() * (max - min + 1)) + min;
                                            const track: Track = playlist ? playlist[random] : [];
                                            localStorage.setItem("playing", JSON.stringify({
                                                name: track.track.name,
                                                artists: track.artists?.map((artist: any) => artist.name).join(", "),
                                                thumbnail: track.thumbnail,
                                                source: source,
                                                id: track.track.id,
                                                // duration: track.track.duration,
                                                playlist: name
                                            }))
                                            localStorage.setItem("time", "0")

                                            const other_tracks: any[] = playlist?.filter((item: any) => item.track.id !== track.track.id) || [];

                                            if (other_tracks.length > 0) {
                                                // check the shuffle mode
                                                const shuffle = localStorage.getItem("shuffle") as string;
                                                if (shuffle === "enable") {
                                                    for (let i = other_tracks.length - 1; i > 0; i--) {
                                                        const j = Math.floor(Math.random() * (i + 1));
                                                        [other_tracks[i], other_tracks[j]] = [other_tracks[j], other_tracks[i]];
                                                    }
                                                }
                                                localStorage.setItem("play queue", JSON.stringify(other_tracks));
                                            }
                                        }
                                    }}>
                                        <FontAwesomeIcon icon={faPlay} />
                                    </span>
                                    <span className="ml-[10px]" onClick={() => {
                                        if (mode == "track") {
                                            if (source === "youtube") {
                                                const url = "https://www.youtube.com/watch?v=" + id;
                                                navigator.clipboard.writeText(url);
                                            }
                                            else {
                                                const url = "https://open.spotify.com/track/" + id;
                                                navigator.clipboard.writeText(url);
                                            }
                                        }
                                        else if (mode === "playlist") {
                                            if (source === "youtube") {
                                                const url = "https://www.youtube.com/playlist?list=" + id;
                                                navigator.clipboard.writeText(url);
                                            }
                                            else {
                                                const url = "https://open.spotify.com/playlist/" + id;
                                                navigator.clipboard.writeText(url);
                                            }
                                        }
                                    }}>
                                        <FontAwesomeIcon icon={faShare} />
                                    </span>
                                    <span className={`ml-[10px] ${(source === "local") ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => {
                                        const queue: any[] = JSON.parse(localStorage.getItem("download queue") as string) || [];
                                        if (queue.findIndex((itemm: any) => {
                                            return itemm.source == source && itemm.mode == mode && itemm.id === id
                                        }) != -1) {
                                            return;
                                        }
                                        queue.push({
                                            name: name,
                                            source: source,
                                            mode: mode,
                                            id: id,
                                        })
                                        localStorage.setItem("download queue", JSON.stringify(queue));

                                    }}>
                                        <FontAwesomeIcon icon={faDownload} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
                    : (
                        <Loading mode={"Loading data"} />
                    )
            }
        </>
    )
}

