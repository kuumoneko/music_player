import {
    faPlay,
    faShare,
    faDownload,
    faThumbTack,
    faFileAudio,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDuration } from "@/mainview/utils/format.ts";
import Loading from "@/mainview/components/Loading/index.tsx";
import { useEffect, useState } from "react";
import add_to_download from "@/mainview/utils/add_download.ts";
import { Shuffle, Track } from "@/shared/types";
import formatArtists from "@/shared/utils/formatArtist";

export default function Top({
    name,
    thumbnail,
    duration,
    releaseDate,
    artists,
    source,
    id,
    mode,
    list,
}: {
    name: string | null;
    thumbnail: string | null;
    duration: number | null;
    releaseDate?: string;
    artists?: { name: string; id: string }[];
    source: "youtube" | "local";
    id: string;
    mode: "tracks" | "playlists" | "artists";
    list: Track[];
}) {
    const [isPin, setiSPin] = useState(false);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const pin = await window.api.rpc.request.getUserData("pin");
            if (cancelled) return;
            if (
                pin.findIndex(
                    (item: string) => item === `${source}:${mode}:${id}`,
                ) != -1
            ) {
                setiSPin(true);
            } else {
                setiSPin(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [name]);
    return (
        <>
            {name !== null && duration !== null ? (
                <div className="flex flex-col w-[90%] mb-3.75 items-center justify-center">
                    <div className="flex flex-row items-center select-none cursor-default">
                        <span>
                            {thumbnail ? (
                                <img
                                    src={thumbnail as string}
                                    alt=""
                                    height={150}
                                    width={150}
                                    className="rounded-lg"
                                />
                            ) : (
                                <FontAwesomeIcon
                                    icon={faFileAudio}
                                    className="text-[50px]"
                                />
                            )}
                        </span>

                        <div className="flex flex-col ml-5">
                            <span className="text-2xl font-bold">{name}</span>
                            <span className="text-lg text-zinc-500">
                                {formatArtists(artists)}
                            </span>
                            <div className="flex flex-row items-center">
                                <span className="releaseDate cursor-default select-none">
                                    {releaseDate}
                                </span>
                                <span className="duration cursor-default select-none ml-3.75">
                                    {duration > 0 && (
                                        <>
                                            {formatDuration(
                                                (duration / 1000) as number,
                                            )}
                                        </>
                                    )}
                                </span>
                            </div>
                            <div className="flex flex-row items-center">
                                <span
                                    onClick={async () => {
                                        const shuffle =
                                            await window.api.rpc.request.getUserData(
                                                "shuffle",
                                            );

                                        const randomlist = (list: Track[]) => {
                                            const randomIndex = Math.floor(
                                                Math.random() * list.length,
                                            );
                                            return list[randomIndex];
                                        };

                                        window.api.rpc.request.play({
                                            item:
                                                shuffle === Shuffle.Enable
                                                    ? randomlist(list)
                                                    : list[0],
                                            source: source,
                                            type: mode,
                                            id: id,
                                        });
                                    }}
                                    className="rounded-full px-1 py-0.5 hover:bg-zinc-600 hover:cursor-pointer"
                                >
                                    <FontAwesomeIcon icon={faPlay} />
                                </span>
                                <span
                                    className="ml-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-600 hover:cursor-pointer"
                                    onClick={() => {
                                        if (mode.includes("track")) {
                                            if (source === "youtube") {
                                                const url =
                                                    "https://www.youtube.com/watch?v=" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url,
                                                ).catch(() => {});
                                            }
                                        } else if (mode.includes("playlist")) {
                                            if (source === "youtube") {
                                                const url =
                                                    "https://www.youtube.com/playlist?list=" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url,
                                                ).catch(() => {});
                                            }
                                        }
                                    }}
                                >
                                    <FontAwesomeIcon icon={faShare} />
                                </span>
                                <span
                                    className={`ml-2.5 ${
                                        source === "local"
                                            ? "opacity-50 pointer-events-none"
                                            : ""
                                    } rounded-full px-1 py-0.5 hover:bg-zinc-600 hover:cursor-pointer`}
                                    onClick={() => {
                                        add_to_download(source, mode, id);
                                    }}
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                </span>
                                <span
                                    className={`pin ml-2.5 rounded-full px-1 py-0.5 hover:bg-zinc-600 hover:cursor-pointer ${
                                        isPin ? "text-red-600" : "text-zinc-600"
                                    }`}
                                    onClick={() => {
                                        async function run() {
                                            let pin =
                                                await window.api.rpc.request.getUserData(
                                                    "pin",
                                                );
                                            if (isPin) {
                                                pin = pin.filter(
                                                    (item: string) => {
                                                        return (
                                                            item !==
                                                            `${source}:${mode}:${id}`
                                                        );
                                                    },
                                                );
                                            } else {
                                                pin.push(
                                                    `${source}:${mode}:${id}`,
                                                );
                                            }
                                            setiSPin(!isPin);

                                            pin = [...new Set(pin)];
                                            await window.api.rpc.request.setUserData(
                                                { key: "pin", data: pin },
                                            );
                                        }
                                        run();
                                    }}
                                >
                                    <FontAwesomeIcon icon={faThumbTack} />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <Loading mode={"data"} />
            )}
        </>
    );
}
