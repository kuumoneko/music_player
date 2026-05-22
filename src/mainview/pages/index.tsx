import Home from "./home.tsx";
import Artists from "@/mainview/pages/music/artists.tsx";
import Playlists from "@/mainview/pages/music/playlists.tsx";
import Search from "@/mainview/pages/music/search.tsx";
import Tracks from "@/mainview/pages/music/tracks.tsx";
import DownloadQueue from "@/mainview/pages/queue/download/index.tsx";
import PlayQueue from "@/mainview/pages/queue/play/index.tsx";
import Local from "@/mainview/pages/music/local.tsx";

function Pages({ url }: { url: string }) {
    if (url.startsWith("/track")) {
        return <Tracks />;
    }
    if (url.startsWith("/playlist")) {
        return <Playlists />;
    }
    if (url.startsWith("/artist")) {
        return <Artists />;
    }
    if (url.startsWith("/search")) {
        return <Search url={url} />;
    }
    if (url.startsWith("/queue/download")) {
        return <DownloadQueue />;
    }
    if (url.startsWith("/queue/play")) {
        return <PlayQueue />;
    }
    if (url.startsWith("/local")) {
        return <Local />;
    }

    return <Home />;
}

export default Pages;
