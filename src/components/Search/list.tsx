import {
    faDownload,
    faListDots,
    faShare,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDuration } from "@/utils/format.ts";
import Loading from "@/components/Loading/index.tsx";
import Play from "@/components/Show/common/play.ts";
import { useEffect, useState } from "react";
import { goto } from "@/utils/url.ts";
import { Track } from "@/types/index.ts";
import Queue from "@/components/Show/common/queue.ts";

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

    useEffect(() => {
        async function run() {
            const temp: any[] = list.slice(sight.head, sight.tail) as any[];
            setlist(temp);
        }
        run();
    }, [sight, list]);

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
                            } flex h-[95px] w-[95%] flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600 rounded-lg`}
                            onClick={() => {
                                if (type === "video") {
                                    Play(item, source, mode, id, list);
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
                                                50
                                            ) as string) ??
                                                item.name ??
                                                "cant load"
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
                                            <span className="duration cursor-default select-none ml-[15px]">
                                                {formatDuration(
                                                    (item.duration as number) /
                                                        1000
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
                                                <FontAwesomeIcon
                                                    icon={faShare}
                                                />
                                            </span>
                                            <span
                                                className="mr-2.5"
                                                onClick={() => {
                                                    Queue(item, source);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faListDots}
                                                />
                                            </span>
                                            {/* <span
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
                                            </span> */}
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
