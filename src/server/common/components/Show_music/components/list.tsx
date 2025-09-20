import {
    faShare,
    faListDots,
    faDownload,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Track } from "../../../../../types";
import formatDuration from "../../../utils/format";
import Loading from "../../Loading";
import download from "../common/download";
import Play from "../common/play";
import Queue from "../common/queue";
import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../utils/fetch";

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
    if (list.length === 0) {
        return <Loading mode={"Loading data"} />;
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
                const data = await fetch_data(Data.playlist, {
                    where: source,
                    id: mode.split(":")[2],
                });
                list.push(...data.tracks);
                list = Array.from(
                    new Set(list.map((item: any) => JSON.stringify(item)))
                ).map((item: any) => JSON.parse(item));
            }
            const temp: any[] = list.slice(sight.head, sight.tail + 1) as any[];
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
            className="listitem flex flex-col max-h-[75%] w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden"
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
            <div className="item h-[100%] grid grid-cols-3">
                {show_list.map((item: Track, index: number) => {
                    return (
                        <div
                            key={
                                item.track?.name ||
                                `${source} ${mode} ${id} ${index}`
                            }
                            className={`vid_${
                                index + 1
                            } flex h-[95px] w-[100%] flex-row items-center justify-between mb-[20px] bg-slate-700 hover:bg-slate-600 rounded-lg`}
                            onDoubleClick={() => {
                                Play(item, source, mode, id, list);
                            }}
                        >
                            <div className="flex flex-row items-center ml-[10px] w-[100%]">
                                <span className="thumbnail cursor-default select-none w-[20%]">
                                    <img
                                        src={item.thumbnail}
                                        alt=""
                                        height={90}
                                        width={90}
                                        className="rounded-lg"
                                    />
                                </span>
                                <div className="flex flex-col ml-[10px] w-[80%]">
                                    <span className="title cursor-default select-none">
                                        {remove_hashtag(
                                            (item.track?.name?.slice(
                                                0,
                                                50
                                            ) as string) || "cant load"
                                        )}
                                    </span>
                                    <span className="artists cursor-default select-none">
                                        {item.artists
                                            ?.map((artist: any) => artist.name)
                                            .join(", ")}
                                    </span>
                                    <div className="flex flex-row items-center justify-between">
                                        <div>
                                            <span className="releaseDate cursor-default select-none">
                                                {item.track?.releaseDate ||
                                                    "cant load"}
                                            </span>
                                            <span className="duration cursor-default select-none ml-[15px]">
                                                {formatDuration(
                                                    (item.track
                                                        ?.duration as number) /
                                                        1000
                                                ) || "cant load"}
                                            </span>
                                        </div>
                                        <div className="action_button flex flex-row-reverse mr-[10px]">
                                            <span
                                                className="mr-[10px]"
                                                onClick={() => {
                                                    if (source === "youtube") {
                                                        const url =
                                                            "https://www.youtube.com/watch?v=" +
                                                            item.track?.id;
                                                        navigator.clipboard.writeText(
                                                            url
                                                        );
                                                    } else {
                                                        const url =
                                                            "https://open.spotify.com/track/" +
                                                            item.track?.id;
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
                                                className="mr-[10px]"
                                                onClick={() => {
                                                    Queue(item, source);
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faListDots}
                                                />
                                            </span>
                                            <span
                                                className={`mr-[10px] ${
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
