import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../common/utils/fetch";
import Loading from "../../../../common/components/Loading/index.tsx";
import Top from "../../../../common/components/Show_music/components/top.tsx";
import List from "../../../../common/components/Show_music/components/list.tsx";
import { Artist } from "../../../../../types/index.ts";

export default function Artistt({ url }: { url: string }) {
    const [dom, setdom] = useState(<Loading mode="Loading artist" />);

    const refresh = async (source: string, id: string) => {
        const artist: Artist = await fetch_data(Data.artist, {
            where: source,
            id: id,
        });
        const tracks = artist.tracks || [];

        const temp = (
            <>
                <Top
                    name={artist.name}
                    thumbnail={artist.thumbnail || ""}
                    duration={0}
                    source={source}
                    id={id}
                    mode={`artist`}
                    playlist={tracks}
                />
                <List
                    list={tracks}
                    source={source}
                    id={id}
                    mode={`artist${
                        artist.playlistId
                            ? ":" + artist.pagetoken + ":" + artist.playlistId
                            : ""
                    }`}
                />
            </>
        );
        setdom(temp);
    };

    useEffect(() => {
        const [source, id] = url.split("/").slice(2);
        refresh(source, id);
    }, [url]);

    useEffect(() => {
        const run = setInterval(() => {
            const [source, id] = url.split("/").slice(2);
            refresh(source, id);
        }, 2000);
        return () => clearInterval(run);
    }, []);

    return dom;
}
