import {
    faDownload,
    faListDots,
    faShare,
    faThumbTack,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDuration } from "@/mainview/utils/format.ts";
import Loading from "@/mainview/components/Loading/index.tsx";
import { useEffect, useState } from "react";
import { goto } from "@/mainview/utils/url.ts";
import { Track } from "@/shared/types.ts";
import Queue from "@/mainview/components/Show/common/queue.ts";
import download from "../Show/common/download";

export default function List({
    list,
    source,
    id,
    mode,
    type,
}: {
    list: Track[];
    source: "youtube" | "local";
    id: string;
    mode: string;
    type: string;
}) {
    const max_items = 15; // 5 rows * 3 cols
    type = type.includes("video") ? "tracks" : type;

    const [sight, set_sight] = useState({
        head: 0,
        tail: Math.min(max_items, list.length),
    });
    const [show_list, setlist] = useState<Track[]>([]);
    const [pin, setPin] = useState<string[]>([]);

    useEffect(() => {
        async function run() {
            const temp = list.slice(sight.head, sight.tail);
            setlist(temp);
        }
        run();
    }, [sight, list]);

    useEffect(() => {
        let cancelled = false;
        window.api.rpc.request.getUserData("pin").then((data) => {
            if (!cancelled) setPin(data);
        });
        return () => {
            cancelled = true;
        };
    }, [list]);

    // remove  #hashtag from the title
    const remove_hashtag = (title: string): string => {
        const temp = title.split(" ").filter((item: string) => {
            return !item.startsWith("#");
        });
        return temp.join(" ");
    };

    if (list.length === 0) {
        return <Loading mode={"Searching"} />;
    }

    return (
        <div
            className="listitem flex flex-col h-[75%] w-full overflow-y-scroll [&::-webkit-scrollbar]:hidden"
            onWheel={(e) => {
                const direction = e.deltaY > 0 ? "down" : "up";
                const temp = sight;
                if (direction === "down") {
                    if (temp.tail + 1 < list.length) {
                        set_sight({
                            head: temp.head + 1,
                            tail: temp.tail + 1,
                        });
                    }
                } else {
                    if (temp.head > 0) {
                        set_sight({
                            head: temp.head - 1,
                            tail: temp.tail - 1,
                        });
                    }
                }
            }}
        >
            <div className="item h-full grid grid-cols-3">
                {show_list.map((item: Track, index: number) => {
                    return (
                        <div
                            key={`${item.name ? item.name + index : `${source} ${mode} ${id} ${index}`}`}
                            className={`vid_${
                                index + 1
                            } flex h-23.75 w-[95%] flex-row items-center justify-between mb-5 bg-zinc-700 hover:bg-zinc-600 rounded-lg`}
                            onClick={() => {
                                if (type === "videos") {
                                    window.api.rpc.request.play({
                                        item: item,
                                        source: source,
                                        type: "tracks",
                                        id: item.id,
                                    });
                                } else if (type === "playlists") {
                                    goto(`/playlists/${source}/${item.id}`);
                                } else if (type === "artists") {
                                    goto(`/artists/${source}/${item.id}`);
                                }
                            }}
                        >
                            <div className="flex flex-row items-center ml-2.5 w-full">
                                <span className="thumbnail cursor-default select-none w-[20%]">
                                    <img
                                        src={item.thumbnail}
                                        alt=""
                                        height={90}
                                        width={90}
                                        className="rounded-lg"
                                    />
                                </span>
                                <div className="flex flex-col ml-2.5 w-[80%]">
                                    <span className="title cursor-default select-none">
                                        {remove_hashtag(
                                            (item.name?.slice(
                                                0,
                                                50,
                                            ) as string) ??
                                                item.name ??
                                                "cant load",
                                        )}
                                    </span>
                                    <span className="artists cursor-default select-none">
                                        {item.artist
                                            ?.map(
                                                (artist: { name: string }) =>
                                                    artist.name,
                                            )
                                            .join(", ")}
                                    </span>
                                    <div className="flex flex-row items-center justify-between">
                                        <div>
                                            <span className="releaseDate cursor-default select-none">
                                                {item.releasedDate ?? ""}
                                            </span>
                                            <span className="duration cursor-default select-none ml-3.75">
                                                {formatDuration(
                                                    (item.duration as number) /
                                                        1000,
                                                ) ?? ""}
                                            </span>
                                        </div>
                                        <div className="action_button flex flex-row-reverse mr-2.5">
                                            <span
                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (source === "youtube") {
                                                        const url =
                                                            "https://www.youtube.com/watch?v=" +
                                                            item.id;
                                                        navigator.clipboard.writeText(
                                                            url,
                                                        );
                                                    }
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faShare}
                                                />
                                            </span>
                                            <span
                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    Queue(item);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faListDots}
                                                />
                                            </span>
                                            <span
                                                className={`mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer ${
                                                    mode === "local"
                                                        ? "opacity-50 pointer-events-none"
                                                        : ""
                                                }`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    download(item);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faDownload}
                                                />
                                            </span>
                                            <span
                                                className={`mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer ${
                                                    pin.filter(
                                                        (data) =>
                                                            data ===
                                                            `${source}:${type}:${item.id}`,
                                                    ).length > 0
                                                        ? "text-red-600"
                                                        : "text-zinc-200"
                                                }`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const isPin =
                                                        pin.filter(
                                                            (data) =>
                                                                data ===
                                                                `${source}:${type}:${item.id}`,
                                                        ).length > 0;
                                                    if (isPin) {
                                                        const temp = pin.filter(
                                                            (itemm: string) => {
                                                                return (
                                                                    itemm !==
                                                                    `${source}:${type}:${item.id}`
                                                                );
                                                            },
                                                        );
                                                        setPin(temp);
                                                        window.api.rpc.request.setUserData(
                                                            {
                                                                key: "pin",
                                                                data: temp,
                                                            },
                                                        );
                                                    } else {
                                                        const temp = [
                                                            ...new Set([
                                                                ...pin,
                                                                `${source}:${type}:${item.id}`,
                                                            ]),
                                                        ];

                                                        window.api.rpc.request.setUserData(
                                                            {
                                                                key: "pin",
                                                                data: temp,
                                                            },
                                                        );
                                                        setPin(temp);
                                                    }
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faThumbTack}
                                                />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
