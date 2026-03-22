import Home from "./home.tsx";
import Albums from "@/mainview/pages/music/albums.tsx";
import Artists from "@/mainview/pages/music/artists.tsx";
import Playlists from "@/mainview/pages/music/playlists.tsx";
import Search from "@/mainview/pages/music/search.tsx";
import Tracks from "@/mainview/pages/music/tracks.tsx";
import DownloadQueue from "@/mainview/pages/queue/download/index.tsx";
import PlayQueue from "@/mainview/pages/queue/play/index.tsx";
import Local from "@/mainview/pages/music/local.tsx";

function Pages({ url }: { url: string }) {
    if (url.includes("track")) {
        return <Tracks />;
    }
    if (url.includes("playlist")) {
        return <Playlists />;
    }
    if (url.includes("artist")) {
        return <Artists />;
    }
    if (url.includes("album")) {
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
