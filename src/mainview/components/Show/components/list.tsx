import {
    faShare,
    faListDots,
    faDownload,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Playlist, Track } from "@/shared/types.ts";
import { formatDuration } from "@/mainview/utils/format.ts";
import Loading from "@/mainview/components/Loading/index.tsx";
import download from "@/mainview/components/Show/common/download.ts";
import Queue from "@/mainview/components/Show/common/queue.ts";
import { useEffect, useState } from "react";

export default function List({
    list,
    source,
    id,
    mode,
}: {
    list: any[];
    source: string;
    id: string;
    mode: string;
}) {
    if (!list || list.length === 0) {
        return <Loading mode={"data"} />;
    }

    const max_items = 18; // 6 rows * 3 cols

    const [sight, set_sight] = useState({
        head: 0,
        tail: Math.min(max_items - 1, list.length - 1),
    });
    const [show_list, setlist] = useState<any[]>([]);

    useEffect(() => {
        async function run() {
            if (
                mode.includes("artist") &&
                mode.split(":")[1] !== undefined &&
                sight.tail > list.length
            ) {
                const data = await window.api.rpc.request.getMusicData({
                    source: source as any,
                    type: "playlists",
                    id,
                });
                list.push(...(data as Playlist).tracks);
                list = [
                    ...new Map(
                        [...list, (data as Playlist).tracks].map(
                            (item: Track) => {
                                return [
                                    `${source}:${mode}:${id}:${item.id}`,
                                    item,
                                ];
                            },
                        ),
                    ).values(),
                ];
            }
            const temp: any[] = list.slice(sight.head, sight.tail + 1) as any[];
            setlist(temp);
        }
        run();
    }, [sight, list]);

    return (
        <div
            className="listitem flex flex-col max-h-[75%] w-full overflow-y-scroll [&::-webkit-scrollbar]:hidden"
            onWheel={(e) => {
                const direction = e.deltaY > 0 ? "down" : "up";
                const temp = sight;
                if (direction === "down") {
                    let head = temp.head + 3;
                    let tail = temp.tail + 3;
                    if (tail >= list.length) {
                        tail = list.length - 1;
                        head = tail - max_items + 1;
                        if (head < 0) {
                            head = 0;
                        }
                    }

                    set_sight({
                        head,
                        tail,
                    });
                } else {
                    let head = temp.head - 3;
                    let tail = temp.tail - 3;
                    if (head < 0) {
                        head = 0;
                        tail = max_items - 1;
                        if (tail > list.length) {
                            tail = list.length - 1;
                        }
                    }
                    set_sight({ head, tail });
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
                                window.api.rpc.request.play({
                                    item: item,
                                    source: source as any,
                                    type: mode as any,
                                    id: id,
                                });
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
                                        {(item.name?.slice(0, 50) as string)
                                            .split(" ")
                                            .filter((item: string) => {
                                                return !item.startsWith("#");
                                            })
                                            .join(" ") ?? "cant load"}
                                    </span>
                                    <span className="artists cursor-default select-none">
                                        {item.artist
                                            ?.map((artist: any) => artist.name)
                                            .join(", ")}
                                    </span>
                                    <div className="flex flex-row items-center justify-between">
                                        <div>
                                            <span className="releaseDate cursor-default select-none">
                                                {item.releasedDate ??
                                                    "cant load"}
                                            </span>
                                            <span className="duration cursor-default select-none ml-3.75">
                                                {formatDuration(
                                                    ((item.duration as number) ??
                                                        0) / 1000,
                                                ) ?? "cant load"}
                                            </span>
                                        </div>
                                        <div className="action_button flex flex-row-reverse mr-2.5">
                                            <span
                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
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
                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                                                onClick={() => {
                                                    Queue(item);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faListDots}
                                                />
                                            </span>
                                            <span
                                                className={`mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer ${
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
