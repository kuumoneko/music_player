import Home from "./home.tsx";
import Albums from "@/pages/music/albums.tsx";
import Artists from "@/pages/music/artists.tsx";
import Playlists from "@/pages/music/playlists.tsx";
import Search from "@/pages/music/search.tsx";
import Tracks from "@/pages/music/tracks.tsx";
import DownloadQueue from "@/pages/queue/download/index.tsx";
import PlayQueue from "@/pages/queue/play/index.tsx";
import Local from "@/pages/music/local.tsx";

function Pages({ url }: { url: string }) {
    if (url.includes("tracks")) {
        return <Tracks />;
    }
    if (url.includes("playlists")) {
        return <Playlists />;
    }
    if (url.includes("artists")) {
        return <Artists />;
    }
    if (url.includes("albums")) {
        return <Albums />;
    }
    if (url.includes("search")) {
        return <Search url={url} />;
    }
    if (url.includes("download")) {
        return <DownloadQueue />;
    }
    if (url.includes("play")) {
        return <PlayQueue />;
    }
    if (url.includes("/local")) {
        return <Local />;
    }

    return <Home />;
}

export default Pages;
