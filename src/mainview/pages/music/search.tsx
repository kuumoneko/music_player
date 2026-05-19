import List from "@/mainview/components/Search/list.tsx";
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
        let cancelled = false;
        (async () => {
            const [source, type, query] = url.split("/").slice(2);
            const res = await window.api.rpc.request.searchMusic({
                type: type as any,
                query: query,
            });
            if (cancelled) return;
            setsearch({
                query,
                source,
                type,
                result: res as any,
            });
        })();
        return () => { cancelled = true; };
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
                              : (searchh.result.artists ?? [])
                    }
                    source={url.split("/").slice(2)[0]}
                    type={url.split("/").slice(2)[1] + "s"}
                    id=""
                    mode="search"
                />
            )}
        </>
    );
}
