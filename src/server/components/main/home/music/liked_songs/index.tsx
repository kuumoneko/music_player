import { useEffect, useState } from "react";
import { Show } from "../music";
import { get } from "../../../../../../dist/function/fetch.ts";

export default function LikedSongs({ url }: { url: string }) {
    const source = url.split("/").slice(3)[1];

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
        const [liked_songs, setliked_songs] = useState(check ? check[source] : []);
        useEffect(() => {
            async function run() {
                const data = await get(`/liked_songs/${source}`);

                // const res = await fetch(`http://localhost:3001/liked_songs/${source}`, {
                //     method: "GET",
                //     headers: {
                //         "Content-Type": "application/json"
                //     }
                // })
                // if (res.status !== 200) {
                //     return;
                // }
                // const data = await res.json();
                // console.log(data);
                setliked_songs(data.tracks);
                localStorage.setItem("liked_songs", JSON.stringify(
                    (source === "youtube" ? {
                        youtube: data.tracks,
                        spotify: check?.spotify || []
                    } : {
                        youtube: check?.youtube || [],
                        spotify: data.tracks
                    })
                ))
            }
            run();
        }, [])

        return (
            <Show list={liked_songs} source={source} id="liked songs" mode="liked songs" />
        )
    }
}
