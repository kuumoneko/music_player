import { useEffect, useState } from "react";
import fetchdata from "@/utils/fetch.ts";
import Top from "@/components/Show/components/top.tsx";
import List from "@/components/Show/components/list.tsx";
import localstorage from "@/utils/localStorage.ts";
import { Track } from "@/types/index.ts";

export default function Local() {
    const check = localstorage("get", "localfile", false);
    const [localfile, setlocalfile] = useState(check ? check : []);
    const [duration, setduration] = useState(0);
    useEffect(() => {
        async function run() {
            const data = await fetchdata("music", "GET", {
                source: "local",
                type: "local",
                id: "local",
            });
            setlocalfile(data.tracks);
            setduration(
                data.tracks.reduce((a: number, b: Track) => a + b.duration, 0)
            );
        }
        run();
    }, []);
    return (
        <>
            <Top
                name="local file"
                thumbnail={null}
                duration={duration}
                releaseDate=""
                artists={[]}
                source="local"
                id=""
                mode="playlist"
                playlist={localfile}
            />
            <List list={localfile} source="local" id="local" mode="local" />
        </>
    );
}
