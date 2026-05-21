import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faMinus, faShare } from "@fortawesome/free-solid-svg-icons";
import { formatDuration } from "@/mainview/utils/format.ts";
import { faYoutube } from "@fortawesome/free-brands-svg-icons";
import Download from "./download.tsx";
import { Artist, Playlist, Track } from "@/shared/types.ts";

export default function Download_Queue() {
    const [queue, setqueue] = useState<string[]>([]);
    const [list, setlist] = useState<{}>({});
    interface Data {
        source: "youtube" | "local";
        mode: string;
        id: string;
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res =
                await window.api.rpc.request.getUserData("downloadQueue");
            if (cancelled) return;

            const data: Data[] = res.map((item) => {
                const [source, mode, id] = item.split(":");
                return {
                    source: source as unknown as "youtube" | "local",
                    mode,
                    id,
                };
            });

            const artists = data.filter((item: Data) =>
                item.mode.includes("artist"),
            );
            const playlists = data.filter((item: Data) =>
                item.mode.includes("playlist"),
            );

            for (const item of artists) {
                const data = await window.api.rpc.request.getMusicData({
                    source: item.source,
                    type: "artists",
                    id: item.id,
                });
                if (cancelled) return;
                playlists.push({
                    source: item.source,
                    mode: "playlist",
                    id: (data as Artist).playlistId,
                });
            }

            let tracks = data.filter((item: Data) =>
                item.mode.includes("track"),
            );

            const temp = {};

            for (const item of playlists) {
                const data: Playlist =
                    await window.api.rpc.request.getMusicData({
                        source: item.source,
                        type: "playlists",
                        id: item.id,
                    });
                if (cancelled) return;

                const tracks_in_playlist = tracks.filter((track: Data) => {
                    return data.tracks.find((trackk: Track) => {
                        return trackk.id === track.id;
                    });
                });

                if (tracks_in_playlist.length > 0) {
                    const minusTracks = tracks.filter((trackItem: Data) => {
                        return !tracks_in_playlist.some(
                            (tempItem: Data) =>
                                tempItem.id === trackItem.id &&
                                tempItem.mode === trackItem.mode,
                        );
                    });
                    tracks = minusTracks;
                }

                temp[`${item.source}:${item.mode}:${item.id}`] = data;
            }
            for (const item of tracks) {
                const data: Track = await window.api.rpc.request.getMusicData({
                    source: item.source,
                    type: "tracks",
                    id: item.id,
                });
                if (cancelled) return;

                temp[`${item.source}:${item.mode}:${item.id}`] = data;
            }

            const downloadQueue = [
                ...playlists.map(
                    (item) => `${item.source}:${item.mode}:${item.id}`,
                ),
                ...tracks.map(
                    (item) => `${item.source}:${item.mode}:${item.id}`,
                ),
            ];
            window.api.rpc.request.setUserData({
                key: "downloadQueue",
                data: downloadQueue,
            });
            setlist(temp);
            setqueue(downloadQueue);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <>
            <div
                onClick={async () => {
                    setlist({});
                    setqueue([]);
                    window.api.rpc.request.setUserData({
                        key: "downloadQueue",
                        data: [],
                    });
                }}
                className="hover:text-red-500 hover:cursor-pointer"
            >
                <FontAwesomeIcon icon={faMinus} />
                Clear queue
            </div>
            <div className="download flex flex-col items-center justify-normal w-full h-full ">
                <div className="title w-[90%] h-[10%] hover:cursor-pointer">
                    <span className="text-4xl">Download queue</span>
                    <Download />
                </div>
                <div className="content w-full flex flex-col max-h-[75%] overflow-y-scroll [&::-webkit-scrollbar]:hidden mt-12.5">
                    {Object.keys(list).map((key: string) => {
                        const item = list[key];
                        const [source, mode] = key.split(":");
                        const id = item.id;

                        return (
                            <div
                                key={`big download ${key}`}
                                className="download flex flex-col"
                            >
                                <div className="flex flex-row bg-zinc-800 mb-3">
                                    <span className="w-12.5 flex flex-row items-center justify-center dot text-zinc-300 hover:text-red-500 hover:cursor-pointer transition-all">
                                        <FontAwesomeIcon
                                            icon={faCircle}
                                            onClick={async () => {
                                                const temp_map = new Map(
                                                    Object.entries(list),
                                                );
                                                temp_map.delete(key);
                                                const temp_obj = {};
                                                temp_map.forEach(
                                                    (
                                                        value:
                                                            | Track
                                                            | Playlist
                                                            | Artist,
                                                        key: string,
                                                    ) => {
                                                        temp_obj[key] = value;
                                                    },
                                                );

                                                setlist(temp_obj);

                                                const queue_list = queue;

                                                const deletedItem =
                                                    queue_list.findIndex(
                                                        (list_item: string) => {
                                                            const [
                                                                sourcee,
                                                                modee,
                                                                idd,
                                                            ] =
                                                                list_item.split(
                                                                    ":",
                                                                );
                                                            return (
                                                                sourcee ===
                                                                    source &&
                                                                modee ===
                                                                    mode &&
                                                                idd === id
                                                            );
                                                        },
                                                    );

                                                queue_list.splice(
                                                    deletedItem,
                                                    1,
                                                );
                                                setqueue(queue_list);
                                                window.api.rpc.request.setUserData(
                                                    {
                                                        key: "downloadQueue",
                                                        data: queue_list,
                                                    },
                                                );
                                            }}
                                        />
                                    </span>
                                    <span className="thumbnail ml-3.75">
                                        <img
                                            src={item.thumbnail}
                                            height={100}
                                            width={100}
                                            className="rounded-3xl"
                                            alt=""
                                        />
                                    </span>
                                    <span className="flex flex-row items-center justify-center ml-2.5">
                                        <span className="mr-1.25">
                                            <FontAwesomeIcon
                                                icon={faYoutube}
                                                className={`size-10 text-red-500`}
                                            />
                                        </span>
                                        <span className="mr-1.25">{mode}</span>
                                        <span className="mr-1.25">
                                            {item.name}
                                        </span>
                                    </span>
                                </div>
                                {mode === "track" ? (
                                    <div
                                        key={`download`}
                                        className={`vid flex h-25 w-full flex-row items-center justify-between mb-5 bg-zinc-700 hover:bg-zinc-600`}
                                    >
                                        <div className="flex flex-row items-center">
                                            <span className="thumbnail cursor-default select-none ml-2.5">
                                                <img
                                                    src={item.thumbnail}
                                                    alt=""
                                                    height={50}
                                                    width={50}
                                                />
                                            </span>
                                            <div className="flex flex-col ml-2.5">
                                                <span className="title cursor-default select-none">
                                                    {item.name ?? "cant load"}
                                                </span>
                                                <span className="artists cursor-default select-none">
                                                    {typeof item.artist ===
                                                    "string"
                                                        ? item.artist
                                                        : item.artist
                                                              .map(
                                                                  (artist: {
                                                                      name: string;
                                                                  }) =>
                                                                      artist.name,
                                                              )
                                                              .join(", ")}
                                                </span>
                                                <div className="flex flex-row items-center">
                                                    <span className="releaseDate cursor-default select-none">
                                                        {item?.releasedDate ??
                                                            "cant load"}
                                                    </span>
                                                    <span className="duration cursor-default select-none ml-3.75">
                                                        {formatDuration(
                                                            (item?.duration as number) /
                                                                1000,
                                                        ) ?? "cant load"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="action_button flex flex-row-reverse mr-2.5">
                                            <span
                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                                onClick={() => {
                                                    if (
                                                        item.source ===
                                                        "youtube"
                                                    ) {
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
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center">
                                        {item.tracks.map(
                                            (itemm: Track, index: number) => {
                                                return (
                                                    <div
                                                        key={`download ${index}`}
                                                        className={`vid flex h-25 w-[90%] flex-row items-center justify-between mb-5 bg-zinc-700 hover:bg-zinc-600 rounded-3xl`}
                                                    >
                                                        <div className="flex flex-row items-center">
                                                            <span className="thumbnail cursor-default select-none ml-2.5">
                                                                <img
                                                                    src={
                                                                        itemm.thumbnail
                                                                    }
                                                                    alt={
                                                                        item.name
                                                                    }
                                                                    height={50}
                                                                    width={50}
                                                                />
                                                            </span>
                                                            <div className="flex flex-col ml-2.5">
                                                                <span className="title cursor-default select-none">
                                                                    {itemm.name ??
                                                                        "cant load"}
                                                                </span>
                                                                <span className="artists cursor-default select-none">
                                                                    {typeof itemm.artist ===
                                                                    "string"
                                                                        ? itemm.artist
                                                                        : itemm.artist
                                                                              .map(
                                                                                  (artist: {
                                                                                      name: string;
                                                                                  }) =>
                                                                                      artist.name,
                                                                              )
                                                                              .join(
                                                                                  ", ",
                                                                              )}
                                                                </span>
                                                                <div className="flex flex-row items-center">
                                                                    <span className="releaseDate cursor-default select-none">
                                                                        {itemm?.releasedDate ??
                                                                            "cant load"}
                                                                    </span>
                                                                    <span className="duration cursor-default select-none ml-3.75">
                                                                        {formatDuration(
                                                                            (itemm?.duration as number) /
                                                                                1000,
                                                                        ) ??
                                                                            "cant load"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="action_button flex flex-row-reverse mr-2.5">
                                                            <span
                                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-500 hover:cursor-pointer"
                                                                onClick={() => {
                                                                    if (
                                                                        itemm.source ===
                                                                        "youtube"
                                                                    ) {
                                                                        const url =
                                                                            "https://www.youtube.com/watch?v=" +
                                                                            itemm.id;
                                                                        navigator.clipboard.writeText(
                                                                            url,
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                <FontAwesomeIcon
                                                                    icon={
                                                                        faShare
                                                                    }
                                                                />
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
