import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";
import Top from "../../../../common/components/Show_music/components/top.tsx";
import List from "../../../../common/components/Show_music/components/list.tsx";
import Loading from "../../../../common/components/Loading/index.tsx";

export default function Playlist({ url }: { url: string }) {
    const [dom, setdom] = useState(<Loading mode="Loading playlist" />);

    const refresh = async (source: string, id: string) => {
        const dataa = await fetch_data(Data.playlist, {
            where: source,
            id: id,
        });
        setdom(
            <>
                <Top
                    name={dataa.name}
                    thumbnail={dataa.thumbnail}
                    duration={dataa.duration}
                    source={source}
                    id={id}
                    mode={"playlist"}
                    playlist={dataa.tracks}
                />
                <List
                    list={dataa.tracks}
                    source={source}
                    id={id}
                    mode="playlist"
                />
            </>
        );
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
