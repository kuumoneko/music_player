import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../common/utils/fetch.ts";
import List from "../../../common/components/Show_music/components/list.tsx";

export default function Show_search({ urll }: { urll: String }) {
    const url = urll.split("/").slice(2);

    const [search, setsearch] = useState(
        JSON.parse(
            localStorage.getItem("search") ??
                JSON.stringify({
                    query: "",
                    source: "",
                    result: {
                        type: "",
                        tracks: [],
                    },
                })
        )
    );

    useEffect(() => {
        async function run() {
            const search = JSON.parse(localStorage.getItem("search") as string);
            if (search.query === url[0] && search.source === url[1]) {
                setsearch(search);
                return;
            }
            const data = await fetch_data(Data.search, {
                where: url[1],
                query: url[0],
            });
            localStorage.setItem(
                "search",
                JSON.stringify({
                    query: url[0],
                    source: url[1],
                    result: data,
                })
            );
            setsearch({
                query: url[0],
                source: url[1],
                result: data,
            });
        }
        run();
    }, []);

    return (
        <>
            {search.result.tracks.length > 0 && (
                <List
                    list={search.result.tracks}
                    source={url[1]}
                    id=""
                    mode="search"
                />
            )}
        </>
    );
}
