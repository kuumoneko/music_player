import { useEffect, useState } from "react";
import { formatDuration } from "@/mainview/utils/format.ts";
import {
    faShare,
    faListDots,
    faDownload,
    faMinus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import add_to_download from "@/mainview/utils/add_download.ts";
import { Track } from "@/shared/types.ts";
import Queue from "@/mainview/components/Show/common/queue";

export default function Play_Queue() {
    const [queue, setqueue] = useState([]);
    const [nextfrom, setnextfrom] = useState({ from: "", next: [] });

    useEffect(() => {
        const run = setInterval(async () => {
            const temp_play_queue =
                await window.api.rpc.request.getUserData("playQueue");
            const temp_nextfrom =
                await window.api.rpc.request.getUserData("nextfrom");
            const [source, mode, id] = temp_nextfrom.split(":") as any;
            const data = await window.api.rpc.request.getMusicData({
                source: source,
                type: mode,
                id: id,
            });
            let track: any = null;
            if (mode === "track") {
                track = data;
            } else {
                // @ts-ignore - tracks exists on Album and Playlist types returned by getMusicData
                track = data.tracks;
            }
            setnextfrom({
                from: temp_nextfrom,
                next: track,
            });
            setqueue(temp_play_queue);
        }, 500);
        return () => clearInterval(run);
    });

    return (
        <>
            <div
                onClick={async () => {
                    window.api.rpc.request.setUserData({
                        key: "playQueue",
                        data: [],
                    });
                    setqueue([]);
                }}
                className="hover:text-red-500 hover:cursor-pointer"
            >
                <FontAwesomeIcon icon={faMinus} />
                Clear queue
            </div>
            <div
                onClick={async () => {
                    window.api.rpc.request.setUserData({
                        key: "nextfrom",
                        data: "",
                    });
                    setnextfrom({
                        from: "",
                        next: [],
                    });
                }}
                className="hover:text-red-500 hover:cursor-pointer"
            >
                <FontAwesomeIcon icon={faMinus} />
                Clear next from
            </div>
            <div className="liked_songs flex flex-col max-h-max w-full overflow-y-scroll [&::-webkit-scrollbar]:hidden">
                {queue.length > 0 && (
                    <>
                        {queue.map((item: Track, index: number) => {
                            return (
                                <div
                                    key={item.name}
                                    className={`queue ${
                                        index + 1
                                    } flex h-25 w-full flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600`}
                                    onDoubleClick={async () => {
                                        window.api.rpc.request.play({
                                            item: item,
                                            source: item.source as any,
                                            type: "track",
                                            id: item.id,
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
                                                {item.artist
                                                    .map(
                                                        (artist: any) =>
                                                            artist.name,
                                                    )
                                                    .join(", ")}
                                            </span>
                                            <div className="flex flex-row items-center">
                                                <span className="releaseDate cursor-default select-none">
                                                    {item.releasedDate}
                                                </span>
                                                <span className="duration cursor-default select-none ml-3.75">
                                                    {formatDuration(
                                                        (item.duration as number) /
                                                            1000,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="action_button flex flex-row-reverse mr-2.5">
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                                            onClick={() => {
                                                if (item.source === "youtube") {
                                                    const url =
                                                        "https://www.youtube.com/watch?v=" +
                                                        item.id;
                                                    navigator.clipboard.writeText(
                                                        url,
                                                    );
                                                }
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faShare} />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                                            onClick={async () => {
                                                Queue(item);
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={faListDots}
                                            />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                                            onClick={() => {
                                                add_to_download(
                                                    item.source,
                                                    "track",
                                                    item.id,
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
                        {nextfrom?.next?.map((item: any, index: number) => {
                            return (
                                <div
                                    key={item.name}
                                    className={`nextfrom ${
                                        index + 1
                                    } flex h-25 w-full flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600`}
                                    onDoubleClick={() => {
                                        window.api.rpc.request.play({
                                            item: item,
                                            source: item.source as any,
                                            type: "track",
                                            id: item.id,
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
                                                            1000,
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="action_button flex flex-row-reverse mr-2.5">
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                                            onClick={() => {
                                                if (item.source === "youtube") {
                                                    const url =
                                                        "https://www.youtube.com/watch?v=" +
                                                        item.id;
                                                    navigator.clipboard.writeText(
                                                        url,
                                                    );
                                                }
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faShare} />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                                            onClick={async () => {
                                                Queue(item);
                                            }}
                                        >
                                            <FontAwesomeIcon
                                                icon={faListDots}
                                            />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
                                            onClick={() => {
                                                add_to_download(
                                                    item.source,
                                                    "track",
                                                    item.id,
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
