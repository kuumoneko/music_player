import List from "@/components/Search/list.tsx";
import fetchdata from "@/utils/fetch.ts";
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
            artists: [],
        },
    });

    useEffect(() => {
        async function run() {
            const [source, type, query] = url.split("/").slice(2);
            const res = await fetchdata(`music`, "GET", {
                query,
                source,
                type,
                mode: "search",
            });
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
                ...(searchh?.result?.artists ?? []),
            ].length > 0 && (
                <List
                    list={
                        url.split("/").slice(2)[1] === "video"
                            ? searchh.result.tracks
                            : url.split("/").slice(2)[1] === "playlist"
                            ? searchh.result.playlists
                            : searchh.result.artists ?? []
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
