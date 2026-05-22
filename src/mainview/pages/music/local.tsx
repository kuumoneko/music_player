import { useCallback, useEffect, useState } from "react";
import Top from "@/mainview/components/Show/components/top.tsx";
import List from "@/mainview/components/Show/components/list.tsx";
import { Track } from "@/shared/types.ts";

export default function Local() {
    const [localfile, setlocalfile] = useState([]);
    const [duration, setduration] = useState(0);

    const fetchLocalfile = useCallback(async () => {
        const data = await window.api.rpc.request.getLocalfile();
        setlocalfile(data);
        setduration(
            data.reduce((a: number, b: Track) => a + b.duration, 0),
        );
    }, []);

    useEffect(() => {
        fetchLocalfile();

        const handler = () => fetchLocalfile();
        window.api.rpc.addMessageListener("local-files-changed", handler);
        return () => {
            window.api.rpc.removeMessageListener("local-files-changed", handler);
        };
    }, [fetchLocalfile]);

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
