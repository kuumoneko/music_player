import { useEffect, useState } from "react";
import Top from "@/mainview/components/Show/components/top.tsx";
import List from "@/mainview/components/Show/components/list.tsx";
import localstorage from "@/mainview/utils/localStorage.ts";
import { Track } from "@/shared/types.ts";

export default function Local() {
    const check = localstorage("get", "localfile", false);
    const [localfile, setlocalfile] = useState(check ? check : []);
    const [duration, setduration] = useState(0);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const fetchData = async () => {
                const data = await window.api.rpc.request.getLocalfile();
                if (cancelled) return;
                setlocalfile(data);
                setduration(
                    data.reduce((a: number, b: Track) => a + b.duration, 0),
                );
            };
            await fetchData();
            const running = setInterval(async () => {
                await fetchData();
            }, 1000);
            return () => { cancelled = true; clearInterval(running); };
        })();
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
                list={localfile}
            />
            <List list={localfile} source="local" id="local" mode="local" />
        </>
    );
}
