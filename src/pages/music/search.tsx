import List from "@/components/Search/list.tsx";
import fetch from "@/utils/fetch.ts";
import { useEffect, useState } from "react";

export default function Search({ url }: { url: string }) {
    const [searchh, setsearch] = useState({
        query: "",
        source: "",
        type: "",
        result: {
            type: "",
            tracks: [],
            playlists: [],
            artist: [],
        },
    });

    useEffect(() => {
        async function run() {
            const [source, type, query] = url.split("/").slice(2);
            const res = await fetch(`/search/${source}/${type}/${query}`, "GET")
            setsearch({
                query,
                source,
                type,
                result: res,
            });
        }
        run();
    }, [url]);
    return (
        <>
            {[
                ...(searchh?.result?.tracks ?? []),
                ...(searchh?.result?.playlists ?? []),
                ...(searchh?.result?.artist ?? []),
            ].length > 0 && (
                <List
                    list={
                        url.split("/").slice(2)[1] === "video"
                            ? searchh.result.tracks
                            : url.split("/").slice(2)[1] === "playlist"
                            ? searchh.result.playlists
                            : searchh.result.artist ?? []
                    }
                    source={url.split("/").slice(2)[0]}
                    type={url.split("/").slice(2)[1]}
                    id=""
                    mode="search"
                />
            )}
        </>
    );
}
