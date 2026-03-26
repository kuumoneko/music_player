import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faMinus, faShare } from "@fortawesome/free-solid-svg-icons";
import { formatDuration } from "@/mainview/utils/format.ts";
import { faYoutube } from "@fortawesome/free-brands-svg-icons";
import Download from "./download.tsx";
import { Playlist } from "@/shared/types.ts";

export default function Download_Queue() {
    const [queue, setqueue] = useState("[]");
    const [list, setlist] = useState("{}");

    useEffect(() => {
        async function run() {
            const res = await window.api.rpc.request.getProfileData("download");

            const playlists = res.filter((item: any) =>
                item.mode.includes("playlist"),
            );
            let tracks = res.filter((item: any) => item.mode.includes("track"));
            const temp: any = {};

            for (const item of playlists) {
                const data = await window.api.rpc.request.getMusicData({
                    source: item.source as any,
                    type: "playlists",
                    id: item.id,
                });

                const tracks_in_playlist = tracks.filter((track: any) => {
                    return ((data as Playlist).tracks as any[]).find(
                        (trackk: any) => {
                            return trackk.track.id === track.id;
                        },
                    );
                });

                if (tracks_in_playlist.length > 0) {
                    const minusTracks = tracks.filter((trackItem: any) => {
                        return !tracks_in_playlist.some(
                            (tempItem: any) =>
                                tempItem.id === trackItem.id &&
                                tempItem.mode === trackItem.mode,
                        );
                    });
                    tracks = minusTracks;
                }

                temp[`${item.source}:${item.mode}:${item.id}`] = data;
            }
            for (const item of tracks) {
                const data = await window.api.rpc.request.getMusicData({
                    source: item.source as any,
                    type: "tracks",
                    id: item.id,
                });

                temp[`${item.source}:${item.mode}:${item.id}`] = data;
            }

            const hehe = [...playlists, ...tracks];
            console.log(hehe);
            window.api.rpc.request.setProfileData({
                key: "download",
                data: hehe,
            });
            setlist(JSON.stringify(temp));
            setqueue(JSON.stringify(hehe));
        }
        run();
    }, []);

    return (
        <>
            <div
                onClick={async () => {
                    setlist("{}");
                    setqueue("[]");
                    window.api.rpc.request.setProfileData({
                        key: "download",
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
                    {Object.keys(JSON.parse(list)).map((key: string) => {
                        const data = JSON.parse(list);
                        const item = data[key];
                        const [source, mode] = key.split(":");
                        const id = item.id;

                        return (
                            <div
                                key={`big download ${key}`}
                                className="download flex flex-col"
                            >
                                <div className="flex flex-row bg-slate-800 mb-3">
                                    <span className="w-12.5 flex flex-row items-center justify-center dot text-slate-300 hover:text-red-500 hover:cursor-pointer transition-all">
                                        <FontAwesomeIcon
                                            icon={faCircle}
                                            onClick={async () => {
                                                const temp_map = new Map(
                                                    Object.entries(data),
                                                );
                                                temp_map.delete(key);
                                                const temp_obj = {};
                                                temp_map.forEach(
                                                    (value: any, key: any) => {
                                                        temp_obj[key] = value;
                                                    },
                                                );

                                                setlist(
                                                    JSON.stringify(temp_obj),
                                                );

                                                const queue_list: any[] =
                                                    JSON.parse(queue);

                                                const deletedItem =
                                                    queue_list.findIndex(
                                                        (list_item: any) => {
                                                            return (
                                                                list_item.source ===
                                                                    source &&
                                                                list_item.mode ===
                                                                    mode &&
                                                                list_item.id ===
                                                                    id
                                                            );
                                                        },
                                                    );

                                                queue_list.splice(
                                                    deletedItem,
                                                    1,
                                                );
                                                setqueue(
                                                    JSON.stringify(queue_list),
                                                );
                                                window.api.rpc.request.setProfileData(
                                                    {
                                                        key: "download",
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
                                        className={`vid flex h-25 w-full flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600`}
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
                                                                  (
                                                                      artist: any,
                                                                  ) =>
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
                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
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
                                            (itemm: any, index: number) => {
                                                return (
                                                    <div
                                                        key={`download ${index}`}
                                                        className={`vid flex h-25 w-[90%] flex-row items-center justify-between mb-5 bg-slate-700 hover:bg-slate-600 rounded-3xl`}
                                                    >
                                                        <div className="flex flex-row items-center">
                                                            <span className="thumbnail cursor-default select-none ml-2.5">
                                                                <img
                                                                    src={
                                                                        itemm.thumbnail
                                                                    }
                                                                    alt=""
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
                                                                                  (
                                                                                      artist: any,
                                                                                  ) =>
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
                                                                className="mr-2.5 rounded-full px-1 py-0.5 hover:bg-slate-500 hover:cursor-pointer"
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
