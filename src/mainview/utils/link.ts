
export default function convert_link(link: string) {
    if (link.includes("youtu")) {
        const youtube_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
        // short form
        let temp: string = "";
        if (youtube_link.includes("youtu.be")) {
            temp = youtube_link.split("youtu.be/")[1].split("&")[0];
        }
        // long form
        else if (youtube_link.includes("youtube.com")) {
            if (youtube_link.includes("watch?=")) {
                temp = youtube_link.split("watch?v=")[1].split("&")[0]
            }
            else if (youtube_link.includes("?list=")) {
                temp = youtube_link.split("?list=")[1].split("&")[0]
            }
            else if (youtube_link.includes("/live/")) {
                temp = youtube_link.split("/live/")[1].split("&")[0]
            }
        }
        else if (youtube_link.includes("@")) {
            temp = youtube_link.split("@")[1].split("&")[0]
            return {
                source: "youtube",
                mode: "artists",
                id: temp
            }
        }
        return {
            source: "youtube",
            mode: temp.length > 20 ? "playlists" : "tracks",
            id: temp
        }
    }
    else {
        return {
            source: undefined,
            mode: undefined,
            id: undefined
        };
    }
}