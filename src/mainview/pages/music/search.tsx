import List from "@/mainview/components/Search/list.tsx";
import { useEffect, useState } from "react";

export default function Search({ url }: { url: string }) {
    const [searchResult, setsearch] = useState({
        query: "",
        source: "",
        type: "",
        result: {
            tracks: [],
            playlists: [],
            artists: [],
        },
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [source, type, query] = url.split("/").slice(2);
            const res = await window.api.rpc.request.searchMusic({
                type: type as "video" | "playlist" | "artist",
                query: query,
            });
            if (cancelled) return;
            setsearch({
                query,
                source,
                type,
                result: res,
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [url]);
    return (
        <>
            {[
                ...(searchResult?.result?.tracks ?? []),
                ...(searchResult?.result?.playlists ?? []),
                ...(searchResult?.result?.artists ?? []),
            ].length > 0 && (
                <List
                    list={
                        url.split("/").slice(2)[1] === "video"
                            ? searchResult.result.tracks
                            : url.split("/").slice(2)[1] === "playlist"
                              ? searchResult.result.playlists
                              : (searchResult.result.artists ?? [])
                    }
                    source={url.split("/").slice(2)[0] as "youtube" | "local"}
                    type={url.split("/").slice(2)[1] + "s"}
                    id=""
                    mode="search"
                />
            )}
        </>
    );
}
