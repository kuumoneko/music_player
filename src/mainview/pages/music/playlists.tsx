import Loading from "@/mainview/components/Loading";
import Music from "@/mainview/components/Music/index.tsx";
import localstorage from "@/mainview/utils/localStorage.ts";
import { goto } from "@/mainview/utils/url";
import { useEffect, useState } from "react";

export default function Playlists() {
    const [dom, setdom] = useState(<></>);
    const [data, setdata] = useState({
        source: "",
        id: "",
    });

    const run = async () => {
        const [source, id] = localstorage("get", "url", "/")
            .split("/")
            .slice(2);
        if (source === undefined || id === undefined) {
            setdom(<Index />);
            return;
        }
        if (source !== data.source || id !== data.id) {
            setdata({
                source,
                id,
            });
            setdom(<Music source={source} type="playlists" id={id} />);
        }
    };

    useEffect(() => {
        run();
        const running = setInterval(() => {
            run();
        }, 1000);
        return () => clearInterval(running);
    }, []);

    return <>{dom}</>;
}

function Index() {
    const [pin, setpin] = useState<any>(null);
    useEffect(() => {
        async function run() {
            const pin: any[] =
                await window.api.rpc.request.getProfileData("pin");
            const playlists = pin.filter((item: any) =>
                item.mode.includes("playlist"),
            );
            setpin(playlists);
        }
        run();
    }, []);
    return (
        <div className="grid grid-cols-7 items-center">
            {pin?.map((playlist: any) => {
                return (
                    <div
                        className="flex flex-row items-center mr-4 my-3 bg-slate-600 p-2 rounded-4xl hover:bg-slate-500 hover:cursor-pointer"
                        onClick={() => {
                            goto(
                                `/playlists/${playlist.source}/${playlist.id}`,
                            );
                        }}
                    >
                        <img
                            className="mr-2 rounded-2xl"
                            src={playlist.thumbnail}
                            height={playlist.source === "spotify" ? 60 : 50}
                            width={playlist.source === "spotify" ? 60 : 80}
                        />
                        <div>{playlist.name.slice(0, 25)}</div>
                    </div>
                );
            }) ?? <Loading mode="artists" />}
        </div>
    );
}
