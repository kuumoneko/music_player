
export default function convert_link(link: string) {
    if (link.includes("youtu")) {
        const youtube_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
        // short form
        let temp: string = "";
        if (youtube_link.includes("youtu.be")) {
            temp = youtube_link.split("youtu.be/")[1];
        }
        // long form
        else if (youtube_link.includes("youtube.com")) {
            if (youtube_link.includes("watch")) {
                temp = youtube_link.split("watch?v=")[1]
            }
            else if (youtube_link.includes("list")) {
                temp = youtube_link.split("?list=")[1]
            }
        }
        return {
            source: "youtube",
            mode: temp.length > 20 ? "playlist" : "track",
            id: temp
        }
    }
    // if link from spotify
    else if (link.includes("spot")) {
        let spotify_link = link.split(link.includes("?si=") ? "?si=" : "&si=")[0];
        const mode = spotify_link.includes("playlist") ? "playlist" : spotify_link.includes("track") ? "track" : "album"
        spotify_link = spotify_link.split(`${mode}/`)[1]
        return {
            source: "spotify",
            mode: mode,
            id: spotify_link
        }
    }
    else {
        return {
            source: "other",
            mode: "",
            id: "This is not a valid link"
        };
    }
}