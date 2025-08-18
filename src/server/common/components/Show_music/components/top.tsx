import { faPlay, faShare, faDownload, faThumbTack, faFileAudio } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Track } from "../../../../../types";
import formatDuration from "../../../utils/format";
import Loading from "../../Loading";
import { useEffect } from "react";

export default function Top({ name, thumbnail, duration, releaseDate, artists, source, id, mode, playlist }: { name: string | null, thumbnail: string | null, duration: number | null, releaseDate?: string, artists?: any[], source: string, id: string, mode: string, playlist?: any[] }) {

    let isPin = false;
    useEffect(() => {
        const run = setInterval(() => {
            const pining: any[] = JSON.parse(localStorage.getItem("pin") || "[]");
            isPin = (pining.filter((item: any) => {
                return item.id === id
            }).length === 0) ? false : true;
            const target = document.getElementsByClassName("pin");
            target[0].className = `pin ml-[10px] ${isPin ? "text-red-600" : "text-slate-600"}`
        }, 500);
        return () => clearInterval(run)
    }, [])
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
                                            {
                                                source === "local" && (
                                                    <FontAwesomeIcon icon={faFileAudio} className="text-[50px]"/>
                                                )
                                            }
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
                                                name: track.track?.name,
                                                artists: track.artists?.map((artist: any) => artist.name).join(", "),
                                                thumbnail: track.thumbnail,
                                                source: source,
                                                id: track.track?.id,
                                                playlist: name
                                            }))
                                            localStorage.setItem("time", "0")

                                            const other_tracks: any[] = playlist?.filter((item: any) => item.track.id !== track.track?.id) || [];

                                            if (other_tracks.length > 0) {
                                                const shuffle = localStorage.getItem("shuffle") as string;
                                                if (shuffle === "enable") {
                                                    for (let i = other_tracks.length - 1; i > 0; i--) {
                                                        const j = Math.floor(Math.random() * (i + 1));
                                                        [other_tracks[i], other_tracks[j]] = [other_tracks[j], other_tracks[i]];
                                                    }
                                                }
                                                localStorage.setItem("nextfrom", JSON.stringify({
                                                    from: "local:local:local",
                                                    tracks: other_tracks.slice(0, 20)
                                                }));
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
                                    <span className={`pin ml-[10px] ${isPin ? "text-red-600" : "text-slate-600"}`} onClick={() => {
                                        let pin = JSON.parse(localStorage.getItem("pin") || "[]");
                                        if (isPin) {
                                            pin = pin.filter((item: any) => {
                                                return item.id !== id
                                            })

                                        }
                                        else {
                                            pin.push({
                                                source: source,
                                                mode: mode,
                                                id: id,
                                                thumbnail: thumbnail,
                                                name: name
                                            })
                                        }
                                        isPin = !isPin;
                                        const temp = Array.from(new Set(pin));
                                        localStorage.setItem("pin", JSON.stringify(temp));
                                    }}>
                                        <FontAwesomeIcon icon={faThumbTack} />
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

