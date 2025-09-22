import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbTack } from "@fortawesome/free-solid-svg-icons";
import { goto } from "../../../utils/url";
import { Data, fetch_data } from "../../../utils/fetch";
import { Track } from "../../../types";
import Play from "../../../components/Show_music/common/play";
import fetch_profile, {
    LocalStorageKeys,
} from "../../../utils/localStorage";

async function checking() {
    const user = await fetch_data(Data.user);
    if (user.youtube.name || user.spotify.name) {
        return true;
    }
    return false;
}

export default function Homepage({ seturl }: { seturl: (a: string) => void }) {
    const [playlists, setplaylists] = useState("[]");
    const [artist, setartist] = useState("[]");
    const [newtracks, setnewtracks] = useState("[]");

    useEffect(() => {
        async function run() {
            const res = await fetch_profile("get", LocalStorageKeys.pin);
            setplaylists(
                JSON.stringify(
                    res.filter((item: any) => {
                        return item.mode === "playlist";
                    })
                )
            );
            setartist(
                JSON.stringify(
                    res.filter((item: any) => {
                        return item.mode === "artist";
                    })
                )
            );
        }
        run();
    }, []);

    useEffect(() => {
        if (artist.length < 1) {
            return;
        }
        async function run() {
            const temp = JSON.parse(artist).map((item: any) => {
                return { source: item.source, id: item.id };
            });
            const data = await fetch_data(Data.new_tracks, { items: temp });
            const sorted_by_date_data = data.sort(
                (a: Track, b: Track) =>
                    new Date(b.track?.releaseDate as string).getTime() -
                    new Date(a.track?.releaseDate as string).getTime()
            );
            setnewtracks(JSON.stringify(sorted_by_date_data));
            localStorage.setItem(
                "new_tracks",
                JSON.stringify(sorted_by_date_data)
            );
        }
        run();
    }, [artist]);

    const [dom, setdom] = useState(<></>);

    useEffect(() => {
        async function run() {
            const value = checking();

            if (!value) {
                setdom(
                    <div>
                        Welcome to Music Player!
                        <span
                            className="login_text text-cyan-400"
                            onClick={() => {
                                goto("/settings", seturl);
                            }}
                        >
                            {" Login "}
                        </span>
                        to use this app.
                    </div>
                );
            } else {
                setdom(
                    <div className="home w-[100%] h-[95%]">
                        <span className="w-[100%] flex flex-row items-center justify-center">
                            Home
                        </span>
                        <div className="flex flex-col w-[100%] ml-[15px] h-[20%]">
                            <div className="flex h-[10%]">
                                <span>
                                    <FontAwesomeIcon icon={faThumbTack} />
                                </span>
                                <span>Your pin:</span>
                            </div>
                            <div className="flex flex-row w-[95%] mt-[20px] h-[30%] overflow-x-scroll [&::-webkit-scrollbar]:hidden">
                                {artist !== "[]" &&
                                    JSON.parse(artist).map((item: any) => {
                                        const temp =
                                            item.mode === "playlist" ? 100 : 50;
                                        return (
                                            <div
                                                key={item.name}
                                                className="flex flex-row items-center bg-slate-800 p-[10px] rounded-3xl mr-[20px] hover:bg-slate-600"
                                                onClick={() => {
                                                    goto(
                                                        `/artist/${item.source}/${item.id}`,
                                                        seturl
                                                    );
                                                }}
                                            >
                                                <span className="mr-[5px]">
                                                    <img
                                                        src={item.thumbnail}
                                                        className="rounded-lg"
                                                        height={temp}
                                                        width={temp}
                                                    />
                                                </span>
                                                <span>{item.name}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="flex flex-row w-[95%] mt-[20px] h-[35%]">
                                {playlists !== "[]" &&
                                    JSON.parse(playlists).map((item: any) => {
                                        const temp =
                                            item.mode === "playlist" ? 60 : 50;
                                        return (
                                            <div
                                                key={item.name}
                                                className="flex flex-row items-center bg-slate-800 p-[5px] rounded-3xl mr-[20px] hover:bg-slate-600"
                                                onClick={() => {
                                                    goto(
                                                        `/playlist/${item.source}/${item.id}`,
                                                        seturl
                                                    );
                                                }}
                                            >
                                                <span className="mr-[5px]">
                                                    <img
                                                        src={item.thumbnail}
                                                        className="rounded-lg"
                                                        height={temp}
                                                        width={temp}
                                                    />
                                                </span>
                                                <span>{item.name}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                        <div className="new tracks grid grid-cols-3 gap-4 ml-[15px] max-h-[70%] mt-[15px] w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden">
                            {newtracks !== "[]" &&
                                JSON.parse(newtracks).map(
                                    (item: Track, index: number) => {
                                        return (
                                            <div
                                                key={
                                                    item.track?.name ||
                                                    `new tracks ${index + 1}`
                                                }
                                                className="flex flex-row h-[100px] w-[500px] bg-slate-800 hover:bg-slate-500 p-[5px] items-center rounded-2xl"
                                                onDoubleClick={() => {
                                                    Play(
                                                        item,
                                                        item.type.split(":")[0],
                                                        "track",
                                                        item.track?.id || "",
                                                        []
                                                    );
                                                }}
                                            >
                                                <span className="h-[100%] w-[100px] flex items-center justify-center">
                                                    <img
                                                        src={
                                                            item.thumbnail || ""
                                                        }
                                                        height={100}
                                                        width={100}
                                                    />
                                                </span>
                                                <div className="flex flex-col ml-[10px] items-start w-[400px]">
                                                    <span className="text-sm w-[100%]">
                                                        {item.track?.name}
                                                    </span>
                                                    <span>
                                                        {item.artists
                                                            ?.map(
                                                                (item: any) => {
                                                                    return item.name;
                                                                }
                                                            )
                                                            .join(", ")}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                        </div>
                    </div>
                );
            }
        }
        run();
    }, [artist, playlists, newtracks]);

    return dom;
}
