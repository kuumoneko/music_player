// import { get } from "../../../../../dist/function/url";
import LikedSongs from "./liked_songs";
import Local from "./local";
import Playlist from "./playlist";
import Track from "./track";

export default function Music({ urll }: { urll: string }) {
    const url = urll.split("/").slice(3);

    if (url[0] == "liked_songs") {
        return (
            <LikedSongs url={urll} />
        )
    }
    else if (url[0] == "playlist") {
        return (
            <Playlist urll={urll} />
        )
    }
    else if (url[0] == "track") {
        return (
            <Track urll={urll} />
        )
    }
    else if (url[0] == "local") {
        return (
            <Local url={urll} />
        )
    }

    return (
        <>

        </>
    )
}