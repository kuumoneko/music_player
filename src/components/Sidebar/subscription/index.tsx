import { faSpotify, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { goto } from "../../../utils/url.ts";
import { Data, fetch_data } from "../../../utils/fetch.ts";
import fetch_profile, {
    LocalStorageKeys,
} from "../../../utils/localStorage.ts";

export default function Artist({ seturl }: { seturl: (a: string) => void }) {
    const [user_artists, set_user_artists] = useState<any[]>([]);

    useEffect(() => {
        async function run() {
            const res = await fetch_profile("get", LocalStorageKeys.artists);
            set_user_artists([...res.youtube, ...res.spotify]);

            const artists = await fetch_data(Data.likedartists);
            console.log(artists);
            set_user_artists([...artists.youtube, ...artists.spotify]);

            if (JSON.stringify(res) !== JSON.stringify(artists)) {
                await fetch_profile("write", LocalStorageKeys.artists, {
                    youtube: artists.youtube,
                    spotify: artists.spotify,
                });
            }
        }
        run();
    }, []);

    return (
        <div className="showplaylist p-0 m-0 flex flex-col w-[100%] overflow-y-scroll [&::-webkit-scrollbar]:hidden h-[74%]">
            {user_artists?.length > 0 &&
                user_artists.map(
                    (
                        item: {
                            type: string;
                            id: string;
                            name: string;
                            thumbnail: string;
                        },
                        index: number
                    ) => {
                        if (!item.id || !item.name || !item.thumbnail) {
                            return <></>;
                        }

                        const sz = item.type.includes("youtube") ? 50 : 60;

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
                                            `/artist/${
                                                item.type.includes("youtube")
                                                    ? "youtube"
                                                    : "spotify"
                                            }/${item.id}`,
                                            seturl
                                        );
                                    }}
                                >
                                    <div className="flex flex-row items-center justify-center w-[100%]">
                                        <span className="thumbnail w-[20%]">
                                            <img
                                                src={item.thumbnail}
                                                alt=""
                                                height={sz}
                                                width={sz}
                                                className="rounded-full"
                                            />
                                        </span>
                                        <span className="w-[10%]">
                                            {item.type.includes("youtube") ? (
                                                <FontAwesomeIcon
                                                    icon={faYoutube}
                                                    className="text-red-500 mx-[5px]"
                                                />
                                            ) : (
                                                <FontAwesomeIcon
                                                    icon={faSpotify}
                                                    className="text-green-500 mx-[5px]"
                                                />
                                            )}
                                        </span>
                                        <span className="title ml-[5px] w-[70%]">
                                            {item.name || ""}
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
