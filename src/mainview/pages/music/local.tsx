import { useEffect, useState } from "react";
import Top from "@/mainview/components/Show/components/top.tsx";
import List from "@/mainview/components/Show/components/list.tsx";
import { Track } from "@/shared/types.ts";

export default function Local() {
    const [localfile, setlocalfile] = useState([]);
    const [duration, setduration] = useState(0);

    useEffect(() => {
        const cancelled = { current: false };
        const running = setInterval(async () => {
            const data = await window.api.rpc.request.getLocalfile();
            if (cancelled.current) return;
            setlocalfile(data);
            setduration(
                data.reduce((a: number, b: Track) => a + b.duration, 0),
            );
        }, 1000);
        window.api.rpc.request.getLocalfile().then((data) => {
            if (cancelled.current) return;
            setlocalfile(data);
            setduration(
                data.reduce((a: number, b: Track) => a + b.duration, 0),
            );
        });
        return () => {
            cancelled.current = true;
            clearInterval(running);
        };
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
                mode="playlists"
                list={localfile}
            />
            <List list={localfile} source="local" id="local" mode="local" />
        </>
    );
}
