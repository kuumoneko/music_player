import { useEffect, useRef } from "react";
import Top from "@/components/Show/components/top.tsx";
import List from "@/components/Show/components/list.tsx";
import fetch from "@/utils/fetch.ts";
import { Track } from "@/types/index.ts";

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
        const result = await fetch(`/music/${source}/${type}/${id}`, "GET");
        const { tracks: new_tracks, ...args } = result;
        tracks.current = new_tracks;
        data.current = args;
    };

    useEffect(() => {
        let run = setInterval(() => {
            getdata();
            if (tracks.current.length > 0) {
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
                playlist={tracks.current}
            />
            <List list={tracks.current} source={source} id={id} mode={type} />
        </>
    );
}
