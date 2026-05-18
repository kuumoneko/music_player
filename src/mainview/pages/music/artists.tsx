import Loading from "@/mainview/components/Loading";
import Music from "@/mainview/components/Music/index.tsx";
import localstorage from "@/mainview/utils/localStorage.ts";
import { goto } from "@/mainview/utils/url";
import { useEffect, useState } from "react";

export default function Artists() {
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
            setdom(<Music source={source} type="artists" id={id} />);
        }
    };

    useEffect(() => {
        run();
        const onUrlChange = () => run();
        window.addEventListener("urlchange", onUrlChange);
        return () => window.removeEventListener("urlchange", onUrlChange);
    }, []);

    return <>{dom}</>;
}

function Index() {
    const [pin, setpin] = useState<any>(null);
    useEffect(() => {
        async function run() {
            const pin: any[] = await window.api.rpc.request.getUserData("pin");
            const artists = pin.filter((item: any) =>
                item.mode.includes("artist"),
            );
            setpin(artists);
        }
        run();
    }, []);
    return (
        <div className="grid grid-cols-7 items-center">
            {pin?.map((artist: any) => {
                return (
                    <div
                        className="flex flex-row items-center mr-4 my-3 bg-zinc-600 p-2 rounded-4xl hover:bg-zinc-500 hover:cursor-pointer"
                        onClick={() => {
                            goto(`/artists/${artist.source}/${artist.id}`);
                        }}
                    >
                        <div>
                            <img
                                className="mr-2 rounded-2xl"
                                src={artist.thumbnail}
                                height={50}
                                width={50}
                                alt=""
                            />
                        </div>
                        <div>{artist.name}</div>
                    </div>
                );
            }) ?? <Loading mode="artists" />}
        </div>
    );
}
