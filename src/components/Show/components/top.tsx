import {
    faPlay,
    faShare,
    faDownload,
    faThumbTack,
    faFileAudio,
    faHeart,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Track } from "@/types/index.ts";
import { formatDuration } from "@/utils/format.ts";
import Loading from "@/components/Loading/index.tsx";
import { useEffect, useState } from "react";
import add_to_download from "@/utils/add_download.ts";
import fetch from "@/utils/fetch.ts";
import localstorage from "@/utils/localStorage.ts";

export default function Top({
    name,
    thumbnail,
    duration,
    releaseDate,
    artists,
    source,
    id,
    mode,
    playlist,
}: {
    name: string | null;
    thumbnail: string | null;
    duration: number | null;
    releaseDate?: string;
    artists?: any[];
    source: string;
    id: string;
    mode: string;
    playlist?: any[];
}) {
    const [isPin, setiSPin] = useState(false);
    useEffect(() => {
        async function run() {
            const pin = await fetch("/profile/pin", "GET");
            if (
                pin.findIndex(
                    (item: any) =>
                        item.id === id &&
                        item.source === source &&
                        item.type === mode
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
                <div className="flex flex-col w-[90%] mb-[15px] items-center justify-center">
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
                                <span className="duration cursor-default select-none ml-[15px]">
                                    {duration > 0 && (
                                        <>
                                            {formatDuration(
                                                (duration / 1000) as number
                                            )}
                                        </>
                                    )}
                                </span>
                            </div>
                            <div className="flex flex-row items-center">
                                <span
                                    onClick={async () => {
                                        if (mode === "track") {
                                            localstorage("set", "playing", {
                                                name: name,
                                                artist: artists
                                                    ?.map(
                                                        (artist: any) =>
                                                            artist.name
                                                    )
                                                    .join(", "),
                                                thumbnail: thumbnail,
                                                source: source,
                                                id: id,
                                            });
                                            localstorage("set", "time", "0");
                                        } else {
                                            const check = localstorage(
                                                "get",
                                                "playing",
                                                {}
                                            );
                                            if (check.playlist === name) {
                                                return;
                                            }

                                            const max =
                                                    (playlist?.length as number) -
                                                    1,
                                                min = 0;
                                            const random =
                                                Math.floor(
                                                    Math.random() *
                                                        (max - min + 1)
                                                ) + min;
                                            const track: Track = playlist
                                                ? playlist[random]
                                                : [];
                                            localstorage("set", "playing", {
                                                name: track.name,
                                                artist: track.artist
                                                    ?.map(
                                                        (artist: any) =>
                                                            artist.name
                                                    )
                                                    .join(", "),
                                                thumbnail: track.thumbnail,
                                                source: source,
                                                id: track.id,
                                                playlist: name,
                                            });
                                            localstorage("set", "time", "0");

                                            const other_tracks: any[] =
                                                playlist?.filter(
                                                    (item: any) =>
                                                        item.id !== track.id
                                                ) ?? [];

                                            if (other_tracks.length > 0) {
                                                const shuffle = localstorage(
                                                    "get",
                                                    "shuffle",
                                                    "disable"
                                                );
                                                if (shuffle === "enable") {
                                                    for (
                                                        let i =
                                                            other_tracks.length -
                                                            1;
                                                        i > 0;
                                                        i--
                                                    ) {
                                                        const j = Math.floor(
                                                            Math.random() *
                                                                (i + 1)
                                                        );
                                                        [
                                                            other_tracks[i],
                                                            other_tracks[j],
                                                        ] = [
                                                            other_tracks[j],
                                                            other_tracks[i],
                                                        ];
                                                    }
                                                }
                                                localstorage(
                                                    "set",
                                                    "nextfrom",
                                                    {
                                                        from: "local:local:local",
                                                        tracks: other_tracks.slice(
                                                            0,
                                                            20
                                                        ),
                                                    }
                                                );
                                            }
                                        }
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
                                                    url
                                                );
                                            } else {
                                                const url =
                                                    "https://open.spotify.com/track/" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url
                                                );
                                            }
                                        } else if (mode === "playlist") {
                                            if (source === "youtube") {
                                                const url =
                                                    "https://www.youtube.com/playlist?list=" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url
                                                );
                                            } else {
                                                const url =
                                                    "https://open.spotify.com/playlist/" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url
                                                );
                                            }
                                        } else if (mode === "album") {
                                            if (source === "spotify") {
                                                const url =
                                                    "https://open.spotify.com/album/" +
                                                    id;
                                                navigator.clipboard.writeText(
                                                    url
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
                                            let pin = await fetch(
                                                "/profile/pin",
                                                "GET"
                                            );
                                            if (isPin) {
                                                pin = pin.filter(
                                                    (item: any) => {
                                                        return item.id !== id;
                                                    }
                                                );
                                            } else {
                                                pin.push({
                                                    source: source,
                                                    mode: mode,
                                                    id: id,
                                                    thumbnail: thumbnail,
                                                    name: name,
                                                });
                                            }
                                            setiSPin(!isPin);
                                            const temp = Array.from(
                                                new Set(pin)
                                            );
                                            await fetch(
                                                "/profile/pin",
                                                "POST",
                                                {
                                                    pin: temp,
                                                }
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
                <Loading mode={"Loading data"} />
            )}
        </>
    );
}
