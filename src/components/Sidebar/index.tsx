import { faSpotify, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { goto } from "../../utils/url.ts";
import { faFileAudio } from "@fortawesome/free-solid-svg-icons";
import Playlist from "./playlist/index.tsx";
import Artist from "./subscription/index.tsx";

export default function Sidebar({ seturl }: { seturl: (a: string) => void }) {
    const [selected, setSelected] = useState("playlists");
    const options = [
        { key: "playlists", label: "Playlists" },
        { key: "artists", label: "Artists" },
    ];

    return (
        <div className="w-[25%] max-w-[250px] h-[100%] p-2 bg-slate-100 text-slate-800 dark:bg-black dark:text-white">
            <div className="logo mb-5">
                <h1 className="text-2xl font-bold">Music App</h1>
            </div>

            <div className="navigation">
                <h2 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 cursor-default select-none">
                    liked songs
                </h2>
                <ul className="list-none p-0 m-0">
                    <li
                        className="mb-2.5 cursor-default select-none"
                        onClick={() => {
                            goto("/liked_songs/youtube", seturl);
                        }}
                    >
                        <FontAwesomeIcon
                            icon={faYoutube}
                            className="text-red-500 mr-[5px]"
                        />
                        <a className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">
                            Youtube
                        </a>
                    </li>
                    <li
                        className="mb-2.5 cursor-default select-none"
                        onClick={() => {
                            goto("/liked_songs/spotify", seturl);
                        }}
                    >
                        <FontAwesomeIcon
                            icon={faSpotify}
                            className="text-green-500 mr-[5px]"
                        />

                        <a className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">
                            Spotify
                        </a>
                    </li>
                    <li
                        className="mb-2.5 cursor-default select-none"
                        onClick={() => {
                            goto("/local", seturl);
                        }}
                    >
                        <FontAwesomeIcon
                            icon={faFileAudio}
                            className="text-slate-300 mr-[5px]"
                        />

                        <a className="text-gray-600 dark:text-neutral-400 no-underline hover:text-black dark:hover:text-white">
                            Local File
                        </a>
                    </li>
                </ul>
            </div>

            <div
                className={`playlists mt-5 cursor-default select-none h-[90%]`}
            >
                <div className="chose_sidebar flex flex-row justify-around">
                    {options.map(({ key, label }) => (
                        <div
                            key={key}
                            className="flex flex-col items-center cursor-pointer"
                            onClick={() => setSelected(key)}
                        >
                            <h2
                                className={`mb-2.5 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 select-none rounded-full ${
                                    selected === key
                                        ? "bg-slate-500 dark:bg-slate-300"
                                        : ""
                                } px-2`}
                            >
                                {label}
                            </h2>
                        </div>
                    ))}
                </div>
                {selected === "playlists" ? (
                    <Playlist seturl={seturl} />
                ) : (
                    <Artist seturl={seturl} />
                )}
            </div>
        </div>
    );
}
