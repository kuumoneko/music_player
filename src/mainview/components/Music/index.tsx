import { useEffect, useRef } from "react";
import Top from "@/mainview/components/Show/components/top.tsx";
import List from "@/mainview/components/Show/components/list.tsx";
import { Track } from "@/shared/types.ts";

export default function Music({
    source,
    type,
    id,
}: {
    source: "youtube" | "spotify";
    type: "tracks" | "playlists" | "albums" | "artists";
    id: string;
}) {
    const tracks = useRef<Track[]>([]);
    const data = useRef<any>({});
    const getdata = async () => {
        const result = await window.api.rpc.request.getMusicData({
            source: source as any,
            type: type as any,
            id: id,
        });

        // @ts-ignore - tracks exists on Album and Playlist types returned by getMusicData
        tracks.current = result.tracks || [result];
        data.current = result || {};
    };

    useEffect(() => {
        let run = setInterval(() => {
            getdata();
            if (tracks?.current?.length > 0) {
                clearInterval(run);
                run = setInterval(() => {
                    getdata();
                }, 60 * 1000);
            }
        }, 1000);

        return () => {
            clearInterval(run);
        };
    }, []);

    return (
        <>
            <Top
                name={data.current.name}
                thumbnail={data.current.thumbnail}
                duration={data.current.duration}
                source={source}
                id={id}
                mode={type}
                list={tracks.current}
            />
            <List list={tracks.current} source={source} id={id} mode={type} />
        </>
    );
}
