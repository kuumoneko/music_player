export default function convert_link(link: string) {
    try {
        const url = new URL(link.startsWith("http") ? link : `https://${link}`);
        const host = url.hostname;

        if (host.includes("youtube.com") || host.includes("youtu.be")) {
            if (host === "youtu.be") {
                const id = url.pathname.slice(1).split("/")[0];
                return { source: "youtube", mode: id.length > 20 ? "playlists" : "tracks", id };
            }

            if (url.pathname.includes("/live/")) {
                const id = url.pathname.split("/live/")[1]?.split("/")[0] ?? "";
                return { source: "youtube", mode: "tracks", id };
            }

            const v = url.searchParams.get("v");
            if (v) {
                return { source: "youtube", mode: "tracks", id: v };
            }

            const list = url.searchParams.get("list");
            if (list) {
                return { source: "youtube", mode: "playlists", id: list };
            }

            if (url.pathname.startsWith("/@")) {
                const channel = url.pathname.split("/@")[1]?.split("/")[0] ?? "";
                return { source: "youtube", mode: "artists", id: channel };
            }
        }
    } catch {}

    return { source: undefined, mode: undefined, id: undefined };
}
