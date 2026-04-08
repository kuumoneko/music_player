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
    list: any[];
    source: string;
    id: string;
    mode: string;
    type: string;
}) {
    if (list.length === 0) {
        return <Loading mode={"Searching"} />;
    }

    const max_items = 15; // 5 rows * 3 cols

    const [sight, set_sight] = useState({
        head: 0,
        tail: Math.min(max_items, list.length),
    });
    const [show_list, setlist] = useState<any[]>([]);
    const [pin, setPin] = useState<any[]>([]);

    useEffect(() => {
        async function run() {
            const temp: any[] = list.slice(sight.head, sight.tail) as any[];
            setlist(temp);
        }
        run();
    }, [sight, list]);

    useEffect(() => {
        window.api.rpc.request
            .getProfileData("pin")
            .then((data) => setPin(data));
    }, [list]);

    // remove  #hashtag from the title
    const remove_hashtag = (title: string): string => {
        const temp = title.split(" ").filter((item: string) => {
            return !item.startsWith("#");
        });
        return temp.join(" ");
    };

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
                            key={
                                item.name ?? `${source} ${mode} ${id} ${index}`
                            }
                            className={`vid_${
                                index + 1
                            } flex h-23.75 w-[95%] flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600 rounded-lg`}
                            onClick={() => {
                                if (type === "video") {
                                    window.api.rpc.request.play({
                                        item: item,
                                        source: source as any,
                                        type: mode as any,
                                        id: item.id,
                                    });
                                } else if (type === "playlist") {
                                    goto(`/playlists/${source}/${item.id}`);
                                } else if (type === "artist") {
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
                                            ?.map((artist: any) => artist.name)
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
                                                className="mr-2.5"
                                                onClick={() => {
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
                                                className="mr-2.5"
                                                onClick={() => {
                                                    Queue(item);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faListDots}
                                                />
                                            </span>
                                            <span
                                                className={`mr-2.5 ${
                                                    mode === "local"
                                                        ? "opacity-50 pointer-events-none"
                                                        : ""
                                                }`}
                                                onClick={() => {
                                                    download(item, source);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faDownload}
                                                />
                                            </span>
                                            <span
                                                className={`mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer ${
                                                    pin.filter(
                                                        (data) =>
                                                            data.source ===
                                                                item.source &&
                                                            data.id ===
                                                                item.id &&
                                                            data.type === type,
                                                    ).length > 0
                                                        ? "text-red-600"
                                                        : "text-slate-200"
                                                }`}
                                                onClick={() => {
                                                    const isPin =
                                                        pin.filter(
                                                            (data) =>
                                                                data.source ===
                                                                    item.source &&
                                                                data.id ===
                                                                    item.id &&
                                                                data.type ===
                                                                    type,
                                                        ).length > 0;
                                                    if (isPin) {
                                                        const temp = pin.filter(
                                                            (item: any) => {
                                                                return (
                                                                    item.id !==
                                                                        id &&
                                                                    item.source !==
                                                                        source &&
                                                                    item.type !==
                                                                        type
                                                                );
                                                            },
                                                        );
                                                        setPin(temp);
                                                        window.api.rpc.request.setProfileData(
                                                            {
                                                                key: "pin",
                                                                data: temp,
                                                            },
                                                        );
                                                    } else {
                                                        const temp = [
                                                            ...new Map(
                                                                [
                                                                    ...pin,
                                                                    {
                                                                        id: item.id,
                                                                        source: item.source,
                                                                        type: type,
                                                                        thumbnail:
                                                                            item.thumbnail,
                                                                        name: item.name,
                                                                    },
                                                                ].map(
                                                                    (item) => [
                                                                        `${item.source}:${type}:${item.id}`,
                                                                        item,
                                                                    ],
                                                                ),
                                                            ).values(),
                                                        ];
                                                        window.api.rpc.request.setProfileData(
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
