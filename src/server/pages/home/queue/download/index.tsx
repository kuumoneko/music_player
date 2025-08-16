import { useEffect, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faMinus, faShare } from "@fortawesome/free-solid-svg-icons";
import formatDuration from "../../../../common/utils/format.ts";
import { faSpotify, faYoutube } from "@fortawesome/free-brands-svg-icons";
import Download from "./download.tsx";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";

export default function Download_Queue() {

    const download_queue = JSON.parse(localStorage.getItem("download queue") || "[]");
    download_queue.sort((a: any, b: any) => {
        if (a.mode === "playlist" && b.mode === "track") {
            return -1;
        }
        if (b.mode === "playlist" && a.mode === "track") {
            return 1;
        }
        return 0
    })

    const [queue, setqueue] = useState(JSON.stringify(download_queue));
    const [list, setlist] = useState("{}");

    useEffect(() => {
        async function run() {
            const queue_list: any[] = JSON.parse(queue);

            if (queue_list.length == 0) {
                return;
            }

            const playlists = queue_list.filter((item: any) => item.mode === "playlist");
            let tracks = queue_list.filter((item: any) => item.mode === "track");


            const temp: any = {}


            for (const item of playlists) {
                const data = await fetch_data(Data.playlist, { where: item.source, id: item.id })
                console.log(data)

                const tracks_in_playlist = tracks.filter((track: any) => {
                    return (data.tracks as any[]).find((trackk: any) => {
                        return trackk.track.id === track.id
                    })
                })

                if (tracks_in_playlist.length > 0) {
                    const tracksminus = tracks.filter((trackItem: any) => {
                        return !tracks_in_playlist.some((tempItem: any) => tempItem.id === trackItem.id && tempItem.mode === trackItem.mode);
                    });
                    tracks = tracksminus
                }

                temp[`${item.source}:${item.mode}:${item.id}`] = data
            }
            for (const item of tracks) {
                const data = await fetch_data(Data.track, { where: item.source, id: item.id })

                temp[`${item.source}:${item.mode}:${item.id}`] = data
            }

            const hehe = [
                ...playlists,
                ...tracks
            ]

            localStorage.setItem("download queue", JSON.stringify(hehe));
            setlist(JSON.stringify(temp));
            setqueue(JSON.stringify(hehe))
        }
        run();
    }, [])

    return (
        <>
            <div onClick={() => { localStorage.setItem("download queue", "[]") }}>
                <FontAwesomeIcon icon={faMinus} />
                Clear queue
            </div>
            <div className="download flex flex-col items-center justify-normal w-[100%] h-[100%] ">
                <div className="title w-[90%] h-[10%]">
                    <span className="text-4xl">
                        Download queue
                    </span>
                    <Download list={JSON.parse(queue)} />
                </div>
                <div className="content w-[100%] flex flex-col max-h-[75%] overflow-y-scroll [&::-webkit-scrollbar]:hidden mt-[50px]">
                    {
                        Object.keys(JSON.parse(list)).map((key: string) => {
                            const data = JSON.parse(list)
                            const item = data[key];
                            const [source, mode] = item.type.split(":");
                            const id = item.id

                            return (
                                <div key={`big download ${key}`} className="download flex flex-col">
                                    <div className="flex flex-row bg-slate-800">
                                        <span className="w-[50px] flex flex-row items-center justify-center dot text-slate-700 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-500 transition-all">
                                            <FontAwesomeIcon icon={faCircle}
                                                onClick={() => {
                                                    const temp_map = new Map(Object.entries(data));
                                                    temp_map.delete(key);
                                                    const temp_obj = {};
                                                    temp_map.forEach((value: any, key: any) => {
                                                        temp_obj[key] = value;
                                                    })

                                                    setlist(JSON.stringify(temp_obj))

                                                    const queue_list: any[] = JSON.parse(queue);

                                                    const deletedItem = queue_list.findIndex((
                                                        list_item: any
                                                    ) => {
                                                        return list_item.source === source && list_item.mode === mode && list_item.id === id
                                                    })

                                                    queue_list.splice(deletedItem, 1);
                                                    setqueue(JSON.stringify(queue_list))
                                                    localStorage.setItem("download queue", JSON.stringify(queue_list))
                                                }}
                                            />
                                        </span>
                                        <span className="thumbnail ml-[15px]">
                                            <img src={item.thumbnail} height={100} width={100} className="rounded-3xl" />
                                        </span>
                                        <span className="flex flex-row items-center justify-center ml-[10px]">
                                            <span className="mr-[5px]">
                                                <FontAwesomeIcon icon={source === "youtube" ? faYoutube : faSpotify} className={`size-10 ${source === "youtube" ? "text-red-500" : "text-green-500"}`} />
                                            </span>
                                            <span className="mr-[5px]">
                                                {
                                                    mode
                                                }
                                            </span>
                                            <span className="mr-[5px]">
                                                {
                                                    mode === "track" ? item.track.name : item.name
                                                }
                                            </span>
                                        </span>
                                    </div>
                                    {
                                        mode === "track" ? (
                                            <div key={`download`} className={`vid flex h-[100px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}>
                                                <div className="flex flex-row items-center">
                                                    <span className="thumbnail cursor-default select-none ml-[10px]" >
                                                        <img src={item.thumbnail} alt="" height={50} width={50} />
                                                    </span>
                                                    <div className="flex flex-col ml-[10px]">
                                                        <span className="title cursor-default select-none" >
                                                            {
                                                                item.track?.name || "cant load"
                                                            }
                                                        </span>
                                                        <span className="artists cursor-default select-none">{typeof item.artist === 'string' ? item.artists : item.artists.map((artist: any) => artist.name).join(", ")}</span>
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
                                                        if (item.type.split(":")[0] === "youtube") {
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

                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                {
                                                    item.tracks.map((itemm: any, index: number) => {
                                                        return (
                                                            <div key={`download ${index}`} className={`vid flex h-[100px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}>
                                                                <div className="flex flex-row items-center">
                                                                    <span className="thumbnail cursor-default select-none ml-[10px]" >
                                                                        <img src={itemm.thumbnail} alt="" height={50} width={50} />
                                                                    </span>
                                                                    <div className="flex flex-col ml-[10px]">
                                                                        <span className="title cursor-default select-none" >
                                                                            {
                                                                                itemm.track?.name || "cant load"
                                                                            }
                                                                        </span>
                                                                        <span className="artists cursor-default select-none">{typeof itemm.artist === 'string' ? itemm.artists : itemm.artists.map((artist: any) => artist.name).join(", ")}</span>
                                                                        <div className="flex flex-row items-center">
                                                                            <span className="releaseDate cursor-default select-none">
                                                                                {itemm.track?.releaseDate || "cant load"}
                                                                            </span>
                                                                            <span className="duration cursor-default select-none ml-[15px]">
                                                                                {formatDuration(itemm.track?.duration as number / 1000) || "cant load"}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="action_button flex flex-row-reverse mr-[10px]">
                                                                    <span className="mr-[10px]" onClick={() => {
                                                                        if (itemm.type.split(":")[0] === "youtube") {
                                                                            const url = "https://www.youtube.com/watch?v=" + itemm.track.id;
                                                                            navigator.clipboard.writeText(url);
                                                                        }
                                                                        else {
                                                                            const url = "https://open.spotify.com/track/" + itemm.track.id;
                                                                            navigator.clipboard.writeText(url);
                                                                        }
                                                                    }}>
                                                                        <FontAwesomeIcon icon={faShare} />
                                                                    </span>

                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                }
                                            </div>
                                        )
                                    }
                                </div>
                            )
                        })
                    }


                </div>
            </div>
        </>
    )
}

const Test_B = ({ list }: { list: string }) => {
    const data = JSON.parse(list);

    return (
        <>
            {
                Object.keys(data).map((key: string) => {
                    const item = data[key];
                    const [source, mode] = item.type.split(":");

                    return (
                        <div key={`big download ${key}`} className="download flex flex-col">
                            <div className="flex flex-row bg-slate-800">
                                <span className="w-[50px] flex flex-row items-center justify-center dot text-slate-700 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-500 transition-all">
                                    <FontAwesomeIcon icon={faCircle}
                                        onClick={() => {
                                            console.log("delete " + item.name)
                                            const temp_map = new Map(Object.entries(data));
                                            temp_map.delete(key);
                                            const temp_obj = {};
                                            temp_map.forEach((value: any, key: any) => {
                                                temp_obj[key] = value;
                                            })


                                        }}
                                    />
                                </span>
                                <span className="thumbnail ml-[15px]">
                                    <img src={item.thumbnail} height={100} width={100} className="rounded-3xl" />
                                </span>
                                <span className="flex flex-row items-center justify-center ml-[10px]">
                                    <span className="mr-[5px]">
                                        <FontAwesomeIcon icon={source === "youtube" ? faYoutube : faSpotify} className={`size-10 ${source === "youtube" ? "text-red-500" : "text-green-500"}`} />
                                    </span>
                                    <span className="mr-[5px]">
                                        {
                                            mode
                                        }
                                    </span>
                                    <span className="mr-[5px]">
                                        {
                                            mode === "track" ? item.track.name : item.name
                                        }
                                    </span>
                                </span>
                            </div>
                            {
                                mode === "track" ? (
                                    <div key={`download`} className={`vid flex h-[100px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}>
                                        <div className="flex flex-row items-center">
                                            <span className="thumbnail cursor-default select-none ml-[10px]" >
                                                <img src={item.thumbnail} alt="" height={50} width={50} />
                                            </span>
                                            <div className="flex flex-col ml-[10px]">
                                                <span className="title cursor-default select-none" >
                                                    {
                                                        item.track?.name || "cant load"
                                                    }
                                                </span>
                                                <span className="artists cursor-default select-none">{typeof item.artist === 'string' ? item.artists : item.artists.map((artist: any) => artist.name).join(", ")}</span>
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
                                                if (item.type.split(":")[0] === "youtube") {
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

                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {
                                            item.tracks.map((itemm: any, index: number) => {
                                                return (
                                                    <div key={`download ${index}`} className={`vid flex h-[100px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}>
                                                        <div className="flex flex-row items-center">
                                                            <span className="thumbnail cursor-default select-none ml-[10px]" >
                                                                <img src={itemm.thumbnail} alt="" height={50} width={50} />
                                                            </span>
                                                            <div className="flex flex-col ml-[10px]">
                                                                <span className="title cursor-default select-none" >
                                                                    {
                                                                        itemm.track?.name || "cant load"
                                                                    }
                                                                </span>
                                                                <span className="artists cursor-default select-none">{typeof itemm.artist === 'string' ? itemm.artists : itemm.artists.map((artist: any) => artist.name).join(", ")}</span>
                                                                <div className="flex flex-row items-center">
                                                                    <span className="releaseDate cursor-default select-none">
                                                                        {itemm.track?.releaseDate || "cant load"}
                                                                    </span>
                                                                    <span className="duration cursor-default select-none ml-[15px]">
                                                                        {formatDuration(itemm.track?.duration as number / 1000) || "cant load"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="action_button flex flex-row-reverse mr-[10px]">
                                                            <span className="mr-[10px]" onClick={() => {
                                                                if (itemm.type.split(":")[0] === "youtube") {
                                                                    const url = "https://www.youtube.com/watch?v=" + itemm.track.id;
                                                                    navigator.clipboard.writeText(url);
                                                                }
                                                                else {
                                                                    const url = "https://open.spotify.com/track/" + itemm.track.id;
                                                                    navigator.clipboard.writeText(url);
                                                                }
                                                            }}>
                                                                <FontAwesomeIcon icon={faShare} />
                                                            </span>

                                                        </div>
                                                    </div>
                                                )
                                            })
                                        }
                                    </div>
                                )
                            }
                        </div>
                    )
                })
            }
        </>
    )
}


const Test_A = ({ list }: { list: string }) => {
    return (
        <>

            {
                (JSON.parse(list as string) as any[]).map((item: any, index: number) => {
                    return (
                        <div key={`download ${index}`} className={`vid ${index + 1} flex h-[200px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600`}>
                            <div className="flex flex-row items-center">
                                <span className="thumbnail cursor-default select-none ml-[10px]" >
                                    <img src={item.thumbnail} alt="" height={100} width={100} />
                                </span>
                                <div className="flex flex-col ml-[10px]">
                                    <span className="title cursor-default select-none" >
                                        {
                                            item.track?.name || "cant load"
                                        }
                                    </span>
                                    <span className="artists cursor-default select-none">{typeof item.artist === 'string' ? item.artists : item.artists.map((artist: any) => artist.name).join(", ")}</span>
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
                                    if (item.type.split(":")[0] === "youtube") {
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

                            </div>
                        </div>
                    )
                })
            }
        </>
    )
}