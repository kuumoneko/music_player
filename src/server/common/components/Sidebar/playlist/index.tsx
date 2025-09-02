import { faSpotify, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { goto } from "../../../utils/url.ts";
import { Data, fetch_data } from "../../../utils/fetch.ts";
import fetch_profile, {
    LocalStorageKeys,
} from "../../../utils/localStorage.ts";

export default function Playlist({ seturl }: { seturl: (a: string) => void }) {
    const usr_playlists = { youtube: [], spotify: [] };

    const [playlist, setplaylist] = useState<any[]>([
        ...usr_playlists.youtube,
        ...usr_playlists.spotify,
    ]);

    useEffect(() => {
        async function run() {
            const res = await fetch_profile("get", LocalStorageKeys.playlists);
            setplaylist([...res.youtube, ...res.spotify]);

            const playlist = await fetch_data(Data.userplaylist);
            setplaylist([...playlist.youtube, ...playlist.spotify]);

            if (JSON.stringify(res) !== JSON.stringify(playlist)) {
                await fetch_profile("write", LocalStorageKeys.playlists, {
                    youtube: playlist.youtube,
                    spotify: playlist.spotify,
                });
            }
        }
        run();
    }, []);

    return (
        <div className="showplaylist p-0 m-0 flex flex-col w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden h-[74%]">
            {playlist.length > 0 &&
                playlist.map(
                    (
                        item: {
                            type: string;
                            playlistId: string;
                            playlistName: string;
                            thumbnail: string;
                        },
                        index: number
                    ) => {
                        if (
                            !item.playlistId ||
                            !item.playlistName ||
                            !item.thumbnail
                        ) {
                            return <></>;
                        }
                        const sz = item.type.includes("youtube") ? 75 : 60;
                        return (
                            <div
                                key={`${
                                    item.type.includes("youtube")
                                        ? "youtube"
                                        : "spotify"
                                } ${index}`}
                                className="my-[2px] hover:bg-slate-500 rounded-lg"
                            >
                                <div
                                    className={`vid ${
                                        index + 1
                                    } flex h-[75px] w-[100%] flex-col justify-center`}
                                    onClick={() => {
                                        goto(
                                            `/playlist/${
                                                item.type.includes("youtube")
                                                    ? "youtube"
                                                    : "spotify"
                                            }/${item.playlistId}`,
                                            seturl
                                        );
                                    }}
                                >
                                    <div className="flex flex-row items-center ml-[10px]">
                                        <span className="thumbnail">
                                            <img
                                                src={item.thumbnail}
                                                alt=""
                                                height={sz}
                                                width={sz}
                                                className="rounded-lg"
                                            />
                                        </span>
                                        <span className="title ml-[5px]">
                                            <span>
                                                {item.type.includes(
                                                    "youtube"
                                                ) ? (
                                                    <FontAwesomeIcon
                                                        icon={faYoutube}
                                                        className="text-red-500 mr-[5px]"
                                                    />
                                                ) : (
                                                    <FontAwesomeIcon
                                                        icon={faSpotify}
                                                        className="text-green-500 mr-[5px]"
                                                    />
                                                )}
                                            </span>
                                            {item.playlistName?.slice(0, 10) ||
                                                ""}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                )}
        </div>
    );
}
