import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../utils/fetch.ts";
import List from "../../../components/Show_music/components/list.tsx";

export default function Show_search({ urll }: { urll: String }) {
    // const url = urll.split("/").slice(2);
    const [url, seturl] = useState(urll.split("/").slice(2));

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
            seturl(urll.split("/").slice(2));
            const temp = urll.split("/").slice(2);

            const search = JSON.parse(localStorage.getItem("search") as string);
            if (
                search.query === temp[0] &&
                search.source === temp[1] &&
                search.result !== null
            ) {
                setsearch(search);
                return;
            }
            const data = await fetch_data(Data.search, {
                where: temp[1],
                query: temp[0],
            });
            localStorage.setItem(
                "search",
                JSON.stringify({
                    query: temp[0],
                    source: temp[1],
                    result: data,
                })
            );
            setsearch({
                query: temp[0],
                source: temp[1],
                result: data,
            });
        }
        run();
    }, [urll]);

    return (
        <>
            {search?.result?.tracks?.length > 0 && (
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
