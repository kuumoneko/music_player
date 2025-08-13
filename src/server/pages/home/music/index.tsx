import Artist from "./artist/index.tsx";
import LikedSongs from "./liked_songs/index.tsx"
import Local from "./local/index.tsx"
import Playlist from "./playlist/index.tsx"
import Track from "./track/index.tsx"

export default function Music({ urll }: { urll: string }) {
    const url = urll.split("/").slice(3);

    if (url[0] == "liked_songs") {
        return (
            <LikedSongs url={urll} />
        )
    }
    else if (url[0] == "playlist") {
        return (
            <Playlist url={urll} />
        )
    }
    else if (url[0] == "track") {
        return (
            <Track url={urll} />
        )
    }
    else if (url[0] == "local") {
        return (
            <Local />
        )
    }
    else if (url[0] == "artist") {
        return (
            <Artist url={urll} />
        )
    }
    return (
        <>

        </>
    )
}