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
    type: "tracks" | "playlists" | "artists";
    id: string;
}) {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [data, setData] = useState<Track>({
        name: "",
        thumbnail: "",
        duration: 0,
        source: "youtube",
        id: "",
        releasedDate: "",
        artist: [],
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await window.api.rpc.request.getMusicData({
                source: source,
                type: type,
                id: id,
            });
            if (cancelled) return;
            setTracks(
                result.tracks || (type.includes("track") ? [result] : []),
            );
            setData(result ?? {});
        })();
        return () => {
            cancelled = true;
        };
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
