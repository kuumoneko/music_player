import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";
import Top from "../../../../common/components/Show_music/components/top.tsx";
import List from "../../../../common/components/Show_music/components/list.tsx";
import Loading from "../../../../common/components/Loading/index.tsx";
import { goto } from "../../../../common/utils/url.ts";
import fetch_profile, {
    LocalStorageKeys,
} from "../../../../common/utils/localStorage.ts";

export default function LikedSongs({
    url,
    seturl,
}: {
    url: string;
    seturl: (a: string) => void;
}) {
    let source = url.split("/").slice(1)[1];

    const [dom, setdom] = useState(<Loading mode="Loading"></Loading>);

    useEffect(() => {
        async function run() {
            const res = await fetch_data(Data.user);

            if (!res[source].name) {
                setdom(
                    <div>
                        <h1 className="text-2xl font-bold">
                            YouTube Access Token is missing
                        </h1>
                        <p className="text-gray-500">
                            Please
                            <span
                                className="login_text text-cyan-400"
                                onClick={() => {
                                    goto("/settings", seturl);
                                }}
                            >
                                {" login "}
                            </span>
                            to
                            {` ${source} `}
                            to view your liked songs.
                        </p>
                    </div>
                );
            } else {
                await refresh(source);
            }
        }
        run();
    }, []);

    const refresh = async (liked_songs_source: string) => {
        const data: any = await fetch_data(Data.likedsongs, {
            where: liked_songs_source,
        });
        const list = data.tracks;
        setdom(
            <>
                <Top
                    name="liked songs"
                    thumbnail={""}
                    duration={0}
                    releaseDate=""
                    playlist={list}
                    source={source}
                    id="liked songs"
                    mode="liked songs"
                />
                <List
                    list={list}
                    source={source}
                    id="liked songs"
                    mode="liked songs"
                />
            </>
        );
    };

    useEffect(() => {
        let source = url.split("/").slice(1)[1];
        refresh(source);
    }, [url]);

    return dom;
}
