import { useEffect, useState } from "react";
import { Data, fetch_data } from "../../../../common/utils/fetch.ts";
import Top from "../../../../common/components/Show_music/components/top.tsx";
import List from "../../../../common/components/Show_music/components/list.tsx";

export default function LikedSongs({ url }: { url: string }) {
    let source = url.split("/").slice(3)[1];

    const access_token = {
        youtube: JSON.parse(localStorage.getItem("user") as string).youtube.access_token,
        spotify: JSON.parse(localStorage.getItem("user") as string).spotify.access_token
    }

    if (source === "youtube" && access_token.youtube === "") {
        return (
            <div>
                <h1 className="text-2xl font-bold">YouTube Access Token is missing</h1>
                <p className="text-gray-500">Please login to YouTube to view your liked songs.</p>
            </div>
        )
    }
    else if (source === "spotify" && access_token.spotify === "") {
        return (
            <div>
                <h1 className="text-2xl font-bold">Spotify Access Token is missing</h1>
                <p className="text-gray-500">Please login to Spotify to view your liked songs.</p>
            </div>
        )
    }
    else {
        const check = JSON.parse(localStorage.getItem("liked_songs") as string);
        const liked_songs = check ? check[source] : [];

        const [dom, setdom] = useState(
            <>
                <Top name={"liked songs"} thumbnail={""} duration={0} releaseDate="" playlist={liked_songs} source={source} id="liked songs" mode="liked songs" />
                <List list={liked_songs} source={source} id="liked songs" mode="liked songs" />
            </>
        );

        const refresh = async (liked_songs_source: string) => {
            const data: any = await fetch_data(Data.likedsongs, { where: liked_songs_source })
            const list = data.tracks
            const temp = (
                <>
                    <Top name={"liked songs"} thumbnail={""} duration={0} releaseDate="" playlist={list} source={source} id="liked songs" mode="liked songs" />
                    <List list={list} source={source} id="liked songs" mode="liked songs" />
                </>
            )
            setdom(temp)
        }

        useEffect(() => {
            let source = url.split("/").slice(3)[1];
            refresh(source);
        }, [url])

        return dom
    }
}
