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
import { usePlayerState } from "@/mainview/context/PlayerContext.tsx";
import formatArtists from "@/shared/utils/formatArtist";

export default function Play_Queue() {
    const { playQueue, nextfrom: nextfromStr } = usePlayerState();
    const [nextfromData, setNextfromData] = useState<{
        from: string;
        next: Track[];
    }>({ from: "", next: [] });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!nextfromStr) {
                setNextfromData({ from: "", next: [] });
                return;
            }
            const [source, mode, id] = nextfromStr.split(":");
            const data = await window.api.rpc.request.getMusicData({
                source: source as "youtube" | "local",
                type: mode as "tracks" | "playlists" | "artists",
                id: id,
            });
            if (cancelled) return;
            let track: Track[] = [];
            if (mode === "track") {
                track = data ? [data] : [];
            } else if (data?.tracks) {
                track = data.tracks;
            }
            setNextfromData({ from: nextfromStr, next: track });
        })();
        return () => {
            cancelled = true;
        };
    }, [nextfromStr]);

    return (
        <>
            <div
                onClick={() =>
                    window.api.rpc.request.setUserData({
                        key: "playQueue",
                        data: [],
                    })
                }
                className="hover:text-red-500 hover:cursor-pointer"
            >
                <FontAwesomeIcon icon={faMinus} />
                Clear queue
            </div>
            <div
                onClick={() =>
                    window.api.rpc.request.setUserData({
                        key: "nextfrom",
                        data: "",
                    })
                }
                className="hover:text-red-500 hover:cursor-pointer"
            >
                <FontAwesomeIcon icon={faMinus} />
                Clear next from
            </div>
            <div className="liked_songs flex flex-col max-h-max w-full overflow-y-scroll [&::-webkit-scrollbar]:hidden">
                {playQueue.length > 0 && (
                    <>
                        {playQueue.map((item: Track, index: number) => {
                            return (
                                <div
                                    key={item.name}
                                    className={`queue ${index + 1} flex h-25 w-full flex-row items-center justify-between mb-5 bg-zinc-700 hover:bg-zinc-600`}
                                    onDoubleClick={() =>
                                        window.api.rpc.request.play({
                                            item,
                                            source: item.source,
                                            type: "tracks",
                                            id: item.id,
                                        })
                                    }
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
                                                {formatArtists(item.artist)}
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
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                            onClick={() => {
                                                if (item.source === "youtube") {
                                                    navigator.clipboard.writeText(
                                                        "https://www.youtube.com/watch?v=" +
                                                            item.id,
                                                    );
                                                }
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faShare} />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                            onClick={() => Queue(item)}
                                        >
                                            <FontAwesomeIcon
                                                icon={faListDots}
                                            />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                            onClick={() =>
                                                add_to_download(
                                                    item.source,
                                                    "track",
                                                    item.id,
                                                )
                                            }
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
                {nextfromData.from !== "" && nextfromData.next.length > 0 && (
                    <>
                        {nextfromData.next.map((item: Track, index: number) => {
                            return (
                                <div
                                    key={item.name}
                                    className={`nextfrom ${index + 1} flex h-25 w-full flex-row items-center justify-between mb-5 bg-zinc-700 hover:bg-zinc-600`}
                                    onDoubleClick={() =>
                                        window.api.rpc.request.play({
                                            item,
                                            source: item.source,
                                            type: "tracks",
                                            id: item.id,
                                        })
                                    }
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
                                                {formatArtists(item.artist)}
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
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                            onClick={() => {
                                                if (item.source === "youtube") {
                                                    navigator.clipboard.writeText(
                                                        "https://www.youtube.com/watch?v=" +
                                                            item.id,
                                                    );
                                                }
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faShare} />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                            onClick={() => Queue(item)}
                                        >
                                            <FontAwesomeIcon
                                                icon={faListDots}
                                            />
                                        </span>
                                        <span
                                            className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                            onClick={() =>
                                                add_to_download(
                                                    item.source,
                                                    "track",
                                                    item.id,
                                                )
                                            }
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
