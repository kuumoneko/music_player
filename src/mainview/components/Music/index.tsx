import { useEffect, useState } from "react";
import Top from "@/mainview/components/Show/components/top.tsx";
import List from "@/mainview/components/Show/components/list.tsx";
import { Track } from "@/shared/types.ts";

export default function Music({
    source,
    type,
    id,
}: {
    source: "youtube";
    type: "tracks" | "playlists" | "albums" | "artists";
    id: string;
}) {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [data, setData] = useState<any>({});

    useEffect(() => {
        const getdata = async () => {
            const result = await window.api.rpc.request.getMusicData({
                source: source as any,
                type: type as any,
                id: id,
            });
            setTracks(result.tracks || (type === "tracks" ? [result] : []));
            setData(result ?? {});
        };
        getdata();
    }, [source, type, id]);

    return (
        <>
            <Top
                name={data.name}
                thumbnail={data.thumbnail}
                duration={data.duration}
                source={source}
                id={id}
                mode={type}
                list={tracks}
            />
            <List list={tracks} source={source} id={id} mode={type} />
        </>
    );
}
