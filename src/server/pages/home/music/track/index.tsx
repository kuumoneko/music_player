import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";
import Top from "../../../../common/components/Show_music/components/top.tsx";
import List from "../../../../common/components/Show_music/components/list.tsx";
import Loading from "../../../../common/components/Loading/index.tsx";

export default function Track({ url }: { url: string }) {
    const [dom, setdom] = useState(<Loading mode="Loading track" />);

    const refresh = async (source: string, id: string) => {
        const dataa = await fetch_data(Data.track, { where: source, id: id });
        setdom(
            <>
                <Top
                    name={dataa[0]?.track.name}
                    thumbnail={dataa[0]?.thumbnail}
                    duration={dataa[0]?.track.duration}
                    releaseDate={dataa[0]?.track.releaseDate}
                    artists={dataa[0]?.artists}
                    source={source}
                    id={id}
                    mode={"track"}
                />
                <List
                    list={
                        dataa[0] !== null
                            ? [
                                  {
                                      thumbnail: dataa[0]?.thumbnail,
                                      track: dataa[0]?.track,
                                      artists: dataa[0]?.artists,
                                      name: dataa[0]?.track.name,
                                      duration: dataa[0]?.track.duration,
                                      releaseDate: dataa[0]?.track.releaseDate,
                                  },
                              ]
                            : []
                    }
                    source={source}
                    id={id}
                    mode="track"
                />
            </>
        );
    };

    useEffect(() => {
        const [source, id] = url.split("/").slice(2);
        refresh(source, id);
    }, [url]);
    return dom;
}
