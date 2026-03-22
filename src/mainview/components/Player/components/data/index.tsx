import { useState, useEffect } from "react";
import { goto } from "@/mainview/utils/url.ts";

export default function DataUI() {
    const [id, setid] = useState<any>("");
    const [name, setname] = useState<any>("");
    const [artists, setartists] = useState<any>("");
    const [thumbnail, setthumbnail] = useState<any>("");
    const [source, setsource] = useState<any>("");

    const update = async () => {
        const data = await window.api.rpc.request.getUserData("currentPlaying");
        setname(data.title);
        setartists(data.artist);
        setthumbnail(data.thumbnail);
        setid(data.id);
        setsource(data.source);

        if ("mediaSession" in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: name,
                artist: artists,
                artwork: [
                    {
                        src: thumbnail,
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            });
            navigator.mediaSession.setActionHandler("play", () =>
                window.api.rpc.request.setUserData({
                    key: "isPlaying",
                    data: true,
                }),
            );
            navigator.mediaSession.setActionHandler("pause", () =>
                window.api.rpc.request.setUserData({
                    key: "isPlaying",
                    data: false,
                }),
            );
            navigator.mediaSession.setActionHandler("nexttrack", () =>
                window.api.rpc.request.next(),
            );
            navigator.mediaSession.setActionHandler("previoustrack", () =>
                window.api.rpc.request.previous(),
            );
        }
    };

    useEffect(() => {
        update();
        const run = window.setInterval(() => {
            async function run() {
                update();
            }
            run();
        }, 100);
        return () => window.clearInterval(run);
    }, []);

    return (
        <div className="flex flex-row items-center ml-3.75">
            <span>
                {thumbnail ? (
                    <img
                        src={thumbnail as string}
                        alt=""
                        height={50}
                        width={50}
                        className="rounded-lg"
                    />
                ) : (
                    <></>
                )}
            </span>
            <div className="currently-playing ml-1.25 cursor-default select-none flex flex-col">
                {id !== "" && (
                    <span
                        className="text-sm hover:underline hover:cursor-pointer"
                        onClick={() => {
                            goto(`/track/${source}/${id}`);
                        }}
                    >
                        {name?.slice(0, 30)}
                    </span>
                )}
                {artists !== "" && <span className="text-sm">{artists}</span>}
            </div>
        </div>
    );
}
