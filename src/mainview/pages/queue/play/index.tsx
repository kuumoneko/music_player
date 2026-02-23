import { useEffect, useState } from "react";
import { formatDuration } from "@/utils/format.ts";
import {
    faShare,
    faListDots,
    faDownload,
    faMinus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { add_items } from "@/utils/add_items.ts";
import add_to_download from "@/utils/add_download.ts";
import localstorage from "@/utils/localStorage.ts";

export default function Play_Queue() {
    const [queue, setqueue] = useState([]);
    const [nextfrom, setnextfrom] = useState({ from: "", tracks: [] });

    useEffect(() => {
        const run = setInterval(async () => {
            const temp_play_queue = localstorage("get", "play", []);
            const temp_nextfrom = localstorage("get", "nextfrom", {});
            setnextfrom(temp_nextfrom);
            setqueue(temp_play_queue);
        }, 500);
        return () => clearInterval(run);
    });

    return (
        <>
            <div
                onClick={async () => {
                    localstorage("set", "play", []);
                }}
            >
                <FontAwesomeIcon icon={faMinus} />
                Clear queue
            </div>
            <div
                onClick={async () => {
                    localstorage("set", "nextfrom", {
                        from: "",
                        tracks: [],
                    });
                }}
            >
                <FontAwesomeIcon icon={faMinus} />
                Clear next from
            </div>
            <div className="liked_songs flex flex-col max-h-max w-full overflow-y-scroll [&::-webkit-scrollbar]:hidden">
                {queue.length > 0 && (
                    <>
                        {queue.map((item: any, index: number) => {
                            return (
                                <div
                                    key={item.name}
                                    className={`queue ${
                                        index + 1
                                    } flex h-25 w-full flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600`}
                                    onDoubleClick={async () => {
                                        localstorage("set", "playing", {
                                            name: item.name,
                                            artist: item.artists,
                                            thumbnail: item.thumbnail,
                                            source: item.source,
                                            id: item.id,
                                            duration: item.duration,
                                        });
                                        localstorage("set", "time", "0");

                                        const trackk = queue.findIndex(
                                            (itemm: any) => {
                                                return itemm.id === item.id;
                                            }
                                        );

                                        setqueue(queue.slice(trackk + 1, -1));
                                        localstorage(
                                            "set",
                                            "play",
                                            queue.slice(trackk + 1, -1)
                                        );
                                    }}
                                >
                                    <div className="flex flex-row items-center ml-2.5">
                                        <span className="thumbnail cursor-default select-none">
                                            <img
                                                src={item.thumbnail}
                                                alt=""
                                                height={100}
                                                width={100}
                                            />
                                        </span>
                                        <div className="flex flex-col ml-2.5">
                                            <span className="title cursor-default select-none">
                                                {item.name}
                                            </span>
                                            <span className="artists cursor-default select-none">
                                                {item.artists}
                                            </span>
                                            <div className="flex flex-row items-center">
                                                <span className="releaseDate cursor-default select-none">
                                                    {item.releaseDate}
                                                </span>
                                                <span className="duration cursor-default select-none ml-3.75">
                                                    {formatDuration(
                                                        (item.duration as number) /
                                                            1000
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="action_button flex flex-row-reverse mr-2.5">
                                        <span
                                            className="mr-2.5"
                                            onClick={() => {
                                                if (item.source === "youtube") {
                                                    const url =
                                                        "https://www.youtube.com/watch?v=" +
                                                        item.id;
                                                    navigator.clipboard.writeText(
                                                        url
                                                    );
                                                } else {
                                                    const url =
                                                        "https://open.spotify.com/track/" +
                                                        item.id;
                                                    navigator.clipboard.writeText(
                                                        url
                                                    );
                                                }
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faShare} />
                                        </span>
                                        <span
                                            className="mr-2.5"
                                            onClick={async () => {
                                                const queue = localstorage(
                                                    "get",
                                                    "play",
                                                    []
                                                );
                                                queue.push({
                                                    name: item.name,
                                                    artist: item.artists,
                                                    thumbnail: item.thumbnail,
                                                    source: item.source,
                                                    id: item.id,
                                                    duration: item.duration,
                                                    time: 0,
                                                });
                                                localstorage(
                                                    "set",
                                                    "play",
                                                    queue
                                                );
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={faListDots}
                                            />
                                        </span>
                                        <span
                                            className="mr-2.5"
                                            onClick={() => {
                                                add_to_download(
                                                    item.source,
                                                    "track",
                                                    item.id,
                                                    item.name
                                                );
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={faDownload}
                                            />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
                {nextfrom?.from !== "" && (
                    <>
                        {nextfrom?.tracks?.map((item: any, index: number) => {
                            return (
                                <div
                                    key={item.name}
                                    className={`nextfrom ${
                                        index + 1
                                    } flex h-25 w-full flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600`}
                                    onDoubleClick={() => {
                                        localstorage("set", "playing", {
                                            name: item.name,
                                            artist: item.artists,
                                            thumbnail: item.thumbnail,
                                            source: item.source,
                                            id: item.id,
                                            duration: item.duration,
                                        });
                                        localstorage("set", "time", "0");

                                        const trackk =
                                            nextfrom.tracks.findIndex(
                                                (itemm: any) => {
                                                    return itemm.id === item.id;
                                                }
                                            );

                                        add_items(
                                            item.source,
                                            nextfrom.from.split(":")[1],
                                            nextfrom.from.split(":")[2],
                                            nextfrom.tracks.slice(
                                                trackk + 1,
                                                -1
                                            )
                                        );

                                        setnextfrom({
                                            from: nextfrom.from,
                                            tracks: nextfrom.tracks.slice(
                                                trackk + 1,
                                                -1
                                            ),
                                        });
                                    }}
                                >
                                    <div className="flex flex-row items-center ml-2.5">
                                        <span className="thumbnail cursor-default select-none">
                                            <img
                                                src={item.thumbnail}
                                                alt=""
                                                height={100}
                                                width={100}
                                            />
                                        </span>
                                        <div className="flex flex-col ml-2.5">
                                            <span className="title cursor-default select-none">
                                                {item.name}
                                            </span>
                                            <span className="artists cursor-default select-none">
                                                {item.artists}
                                            </span>
                                            <div className="flex flex-row items-center">
                                                <span className="releaseDate cursor-default select-none">
                                                    {item.releaseDate}
                                                </span>
                                                <span className="duration cursor-default select-none ml-3.75">
                                                    {formatDuration(
                                                        (item.duration as number) /
                                                            1000
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="action_button flex flex-row-reverse mr-2.5">
                                        <span
                                            className="mr-2.5"
                                            onClick={() => {
                                                if (item.source === "youtube") {
                                                    const url =
                                                        "https://www.youtube.com/watch?v=" +
                                                        item.id;
                                                    navigator.clipboard.writeText(
                                                        url
                                                    );
                                                } else {
                                                    const url =
                                                        "https://open.spotify.com/track/" +
                                                        item.id;
                                                    navigator.clipboard.writeText(
                                                        url
                                                    );
                                                }
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faShare} />
                                        </span>
                                        <span
                                            className="mr-2.5"
                                            onClick={async () => {
                                                const queue = localstorage(
                                                    "get",
                                                    "play",
                                                    []
                                                );
                                                queue.push({
                                                    name: item.name,
                                                    artist: item.artists,
                                                    thumbnail: item.thumbnail,
                                                    source: item.source,
                                                    id: item.id,
                                                    duration: item.duration,
                                                    time: 0,
                                                });
                                                localstorage(
                                                    "set",
                                                    "play",
                                                    queue
                                                );
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={faListDots}
                                            />
                                        </span>
                                        <span
                                            className="mr-2.5"
                                            onClick={() => {
                                                add_to_download(
                                                    item.source,
                                                    "track",
                                                    item.id,
                                                    item.name
                                                );
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={faDownload}
                                            />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </>
    );
}
