import {
    faPlay,
    faShare,
    faDownload,
    faThumbTack,
    faFileAudio,
    faHeart,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDuration } from "@/mainview/utils/format.ts";
import Loading from "@/mainview/components/Loading/index.tsx";
import { useEffect, useState } from "react";
import add_to_download from "@/mainview/utils/add_download.ts";
import { Shuffle } from "@/shared/types";

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
    artists?: any[];
    source: string;
    id: string;
    mode: string;
    list: any[];
}) {
    const [isPin, setiSPin] = useState(false);
    useEffect(() => {
        async function run() {
            const pin = await window.api.rpc.request.getProfileData("pin");
            if (
                pin.findIndex(
                    (item: any) =>
                        item.id === id &&
                        item.source === source &&
                        item.type === mode,
                ) != -1
            ) {
                setiSPin(true);
            } else {
                setiSPin(false);
            }
        }
        run();
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
                                <>
                                    {source === "local" && (
                                        <FontAwesomeIcon
                                            icon={faFileAudio}
                                            className="text-[50px]"
                                        />
                                    )}
                                    {mode === "liked songs" && (
                                        <FontAwesomeIcon
                                            icon={faHeart}
                                            className={`text-[50px] ${
                                                source === "youtube"
                                                    ? "text-red-600"
                                                    : "text-green-600"
                                            }`}
                                        />
                                    )}
                                </>
                            )}
                        </span>

                        <div className="flex flex-col ml-5">
                            <span className="text-2xl font-bold">{name}</span>
                            <span className="text-lg text-gray-500">
                                {artists
                                    ?.map((artist: any) => artist.name)
                                    .join(", ")}
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

                                        const randomlist = (list: any[]) => {
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
                                            source: source as any,
                                            type: mode as any,
                                            id: id,
                                        });
                                    }}
                                >
                                    <FontAwesomeIcon icon={faPlay} />
                                </span>
                                <span
                                    className="ml-2.5"
                                    onClick={() => {
                                        if (mode == "track") {
                                            if (source === "youtube") {
                                                const url =
                                                    "https://www.youtube.com/watch?v=" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url,
                                                );
                                            } else {
                                                const url =
                                                    "https://open.spotify.com/track/" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url,
                                                );
                                            }
                                        } else if (mode === "playlist") {
                                            if (source === "youtube") {
                                                const url =
                                                    "https://www.youtube.com/playlist?list=" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url,
                                                );
                                            } else {
                                                const url =
                                                    "https://open.spotify.com/playlist/" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url,
                                                );
                                            }
                                        } else if (mode === "album") {
                                            if (source === "spotify") {
                                                const url =
                                                    "https://open.spotify.com/album/" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url,
                                                );
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
                                    }`}
                                    onClick={() => {
                                        add_to_download(source, mode, id, name);
                                    }}
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                </span>
                                <span
                                    className={`pin ml-2.5 ${
                                        isPin
                                            ? "text-red-600"
                                            : "text-slate-600"
                                    }`}
                                    onClick={() => {
                                        async function run() {
                                            let pin =
                                                await window.api.rpc.request.getProfileData(
                                                    "pin",
                                                );
                                            if (isPin) {
                                                pin = pin.filter(
                                                    (item: any) => {
                                                        return (
                                                            item.id !== id &&
                                                            item.source !==
                                                                source &&
                                                            item.type !== mode
                                                        );
                                                    },
                                                );
                                            } else {
                                                pin.push({
                                                    source: source,
                                                    type: mode,
                                                    id: id,
                                                    thumbnail: thumbnail,
                                                    name: name,
                                                });
                                            }
                                            setiSPin(!isPin);

                                            pin = [
                                                ...new Map(
                                                    pin.map((item) => [
                                                        `${item.source}:${item.type}:${item.id}`,
                                                        item,
                                                    ]),
                                                ).values(),
                                            ];
                                            await window.api.rpc.request.setProfileData(
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
