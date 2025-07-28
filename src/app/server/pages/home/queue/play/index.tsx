import { useEffect, useState } from "react"
import formatDuration from "../../../../common/utils/format.ts";
import { faShare, faListDots, faDownload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { add_items } from "../../../../common/utils/add_items.ts";

export default function Play_Queue() {
    const [queue, setqueue] = useState(JSON.parse(localStorage.getItem("play queue") as string));
    const [nextfrom, setnextfrom] = useState(JSON.parse(localStorage.getItem("nextfrom") as string));

    useEffect(() => {
        const run = window.setInterval(() => {
            setnextfrom(JSON.parse(localStorage.getItem("nextfrom") as string));
            setqueue(JSON.parse(localStorage.getItem("play queue") as string));

        }, 500);
        return () => window.clearInterval(run);
    })


    return (
        <div className="liked_songs flex flex-col max-h-max w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden">
            {
                queue.length > 0 && (
                    <>
                        {
                            queue.map((item: any, index: number) => {
                                return (
                                    <div className={`queue ${index + 1} flex h-[200px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}
                                        onDoubleClick={(e) => {
                                            localStorage.setItem("playing", JSON.stringify({
                                                name: item.name,
                                                artists: item.artists,
                                                thumbnail: item.thumbnail,
                                                source: item.source,
                                                id: item.id,
                                                duration: item.duration,
                                            }))
                                            localStorage.setItem("time", "0")

                                            const trackk = queue.findIndex((itemm: any) => {
                                                return itemm.track.id === item.id;
                                            })

                                            setqueue(queue.slice(trackk + 1, -1));
                                            localStorage.setItem("play queue", JSON.stringify(queue.slice(trackk + 1, -1)));
                                        }}
                                    >

                                        <div className="flex flex-row items-center ml-[10px]" >
                                            <span className="thumbnail cursor-default select-none" >
                                                <img src={item.thumbnail} alt="" height={100} width={100} />
                                            </span>
                                            <div className="flex flex-col ml-[10px]">
                                                <span className="title cursor-default select-none" >
                                                    {
                                                        item.name
                                                    }
                                                </span>
                                                <span className="artists cursor-default select-none">{item.artists}</span>
                                                <div className="flex flex-row items-center">
                                                    <span className="releaseDate cursor-default select-none">
                                                        {item.releaseDate}
                                                    </span>
                                                    <span className="duration cursor-default select-none ml-[15px]">
                                                        {formatDuration(item.duration as number / 1000)}
                                                    </span>
                                                </div>

                                            </div>
                                        </div>

                                        <div className="action_button flex flex-row-reverse mr-[10px]">
                                            <span className="mr-[10px]" onClick={() => {
                                                if (item.source === "youtube") {
                                                    const url = "https://www.youtube.com/watch?v=" + item.id;
                                                    navigator.clipboard.writeText(url);
                                                }
                                                else {
                                                    const url = "https://open.spotify.com/track/" + item.id;
                                                    navigator.clipboard.writeText(url);
                                                }
                                            }}>
                                                <FontAwesomeIcon icon={faShare} />
                                            </span>
                                            <span className="mr-[10px]" onClick={() => {
                                                const queue = JSON.parse(localStorage.getItem("play queue") as string) || [];
                                                queue.push({
                                                    name: item.name,
                                                    artists: item.artists,
                                                    thumbnail: item.thumbnail,
                                                    source: item.source,
                                                    id: item.id,
                                                    duration: item.duration,
                                                    time: 0,
                                                })
                                                localStorage.setItem("play queue", JSON.stringify(queue));

                                            }}>
                                                <FontAwesomeIcon icon={faListDots} />
                                            </span>
                                            <span className="mr-[10px]" onClick={() => {
                                                const queue = JSON.parse(localStorage.getItem("download queue") as string) || [];
                                                queue.push({
                                                    name: item.name,
                                                    source: item.source,
                                                    id: item.id,
                                                })
                                                localStorage.setItem("download queue", JSON.stringify(queue));

                                            }}>
                                                <FontAwesomeIcon icon={faDownload} />
                                            </span>

                                        </div>
                                    </div>
                                )
                            })
                        }
                    </>
                )
            }
            {
                nextfrom?.from !== "" && (
                    <>
                        {
                            nextfrom?.tracks?.map((item: any, index: number) => {
                                return (
                                    <div>
                                        <div className={`nextfrom ${index + 1} flex h-[200px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}
                                            onDoubleClick={(e) => {
                                                localStorage.setItem("playing", JSON.stringify({
                                                    name: item.name,
                                                    artists: item.artists,
                                                    thumbnail: item.thumbnail,
                                                    source: item.source,
                                                    id: item.id,
                                                    duration: item.duration,
                                                }))
                                                localStorage.setItem("time", "0")

                                                const trackk = nextfrom.tracks.findIndex((itemm: any) => {
                                                    return itemm.id === item.id;
                                                })

                                                add_items(item.source, nextfrom.from.split(":")[1], nextfrom.from.split(":")[2], nextfrom.tracks.slice(trackk + 1, -1))

                                                setnextfrom({
                                                    from: nextfrom.from,
                                                    tracks: nextfrom.tracks.slice(trackk + 1, -1)
                                                });
                                                // localStorage.setItem("nextfrom", JSON.stringify({
                                                //     from: nextfrom.from,
                                                //     tracks: nextfrom.tracks.slice(trackk + 1, -1)
                                                // }));
                                            }}
                                        >

                                            <div className="flex flex-row items-center ml-[10px]" >
                                                <span className="thumbnail cursor-default select-none" >
                                                    <img src={item.thumbnail} alt="" height={100} width={100} />
                                                </span>
                                                <div className="flex flex-col ml-[10px]">
                                                    <span className="title cursor-default select-none" >
                                                        {
                                                            item.name
                                                        }
                                                    </span>
                                                    <span className="artists cursor-default select-none">{item.artists}</span>
                                                    <div className="flex flex-row items-center">
                                                        <span className="releaseDate cursor-default select-none">
                                                            {item.releaseDate}
                                                        </span>
                                                        <span className="duration cursor-default select-none ml-[15px]">
                                                            {formatDuration(item.duration as number / 1000)}
                                                        </span>
                                                    </div>

                                                </div>
                                            </div>

                                            <div className="action_button flex flex-row-reverse mr-[10px]">
                                                <span className="mr-[10px]" onClick={() => {
                                                    if (item.source === "youtube") {
                                                        const url = "https://www.youtube.com/watch?v=" + item.id;
                                                        navigator.clipboard.writeText(url);
                                                    }
                                                    else {
                                                        const url = "https://open.spotify.com/track/" + item.id;
                                                        navigator.clipboard.writeText(url);
                                                    }
                                                }}>
                                                    <FontAwesomeIcon icon={faShare} />
                                                </span>
                                                <span className="mr-[10px]" onClick={() => {
                                                    const queue = JSON.parse(localStorage.getItem("play queue") as string) || [];
                                                    queue.push({
                                                        name: item.name,
                                                        artists: item.artists,
                                                        thumbnail: item.thumbnail,
                                                        source: item.source,
                                                        id: item.id,
                                                        duration: item.duration,
                                                        time: 0,
                                                    })
                                                    localStorage.setItem("play queue", JSON.stringify(queue));

                                                }}>
                                                    <FontAwesomeIcon icon={faListDots} />
                                                </span>
                                                <span className="mr-[10px]" onClick={() => {
                                                    const queue = JSON.parse(localStorage.getItem("download queue") as string) || [];
                                                    queue.push({
                                                        name: item.name,
                                                        source: item.source,
                                                        id: item.id,
                                                    })
                                                    localStorage.setItem("download queue", JSON.stringify(queue));

                                                }}>
                                                    <FontAwesomeIcon icon={faDownload} />
                                                </span>

                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </>
                )
            }
        </div>
    )
}