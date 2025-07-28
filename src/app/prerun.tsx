export const running = () => {
    const check_storage = (id: string) => {
        return localStorage.getItem(id) === null || localStorage.getItem(id) === undefined;
    }

    if (document.referrer.includes("localhost:") === false) {
        localStorage.setItem("backward", "[]");
        localStorage.setItem("forward", "[]");
    }

    if (check_storage("user")) {
        localStorage.setItem("user", JSON.stringify({
            youtube: {
                user: {
                    name: "",
                    thumbnail: ""
                }
            },
            spotify: {
                user: {
                    name: "",
                    email: "",
                    id: "",
                },
            }
        }))
    }


    if (check_storage("playing")) {
        localStorage.setItem("playing", JSON.stringify({
            name: "",
            artists: "",
            thumbnail: "",
            source: "",
            id: "",
            duration: "",
        }))
    }

    const gett = JSON.parse(localStorage.getItem("playlists") as string)
    if (check_storage("playlists") || gett.youtube === undefined || gett.spotify === undefined || gett.youtube.length === 0 || gett.spotify.length === 0) {
        localStorage.setItem("playlists", JSON.stringify({
            youtube: [],
            spotify: []
        }))
    }

    if (check_storage("play_url")) {
        localStorage.setItem("play_url", JSON.stringify({
            id: "",
            url: "",
            source: ""
        }))
    }

    if (check_storage("play queue")) {
        localStorage.setItem("play queue", JSON.stringify([]))
    }

    if (check_storage("download queue")) {
        localStorage.setItem("download queue", JSON.stringify([]))
    }

    if (check_storage("playedsongs")) {
        localStorage.setItem("playedsongs", JSON.stringify([]))
    }

    if (check_storage("backward")) {
        localStorage.setItem("backward", JSON.stringify([]))
    }

    if (check_storage("forward")) {
        localStorage.setItem("forward", JSON.stringify([]))
    }

    if (check_storage("nextfrom")) {
        localStorage.setItem("nextfrom", JSON.stringify({
            from: "",
            tracks: []
        }))
    }

    if (check_storage("url")) {
        localStorage.setItem("url", "http://localhost:3000/")
    }

    if (check_storage("repeat")) {
        localStorage.setItem("repeat", "disable")
    }

    if (check_storage("shuffle")) {
        localStorage.setItem("shuffle", "disable")
    }

    if (check_storage("kill time")) {
        localStorage.setItem("kill time", "nosleep")
    }

    if (check_storage("liked_songs")) {
        localStorage.setItem("liked_songs", JSON.stringify({
            youtube: [],
            spotify: []
        }))
    }

    if (check_storage("local")) {
        localStorage.setItem("local", "")
    }
    if (check_storage("preferredAudioFormat")) {
        localStorage.setItem("preferredAudioFormat", "mp3")
    }
    if (check_storage("search")) {
        localStorage.setItem("search", JSON.stringify({
            query: "",
            source: "youtube",
            result: {
                type: "",
                tracks: []
            }
        }))
    }
    if (check_storage("theme")) {
        localStorage.setItem("theme", "dark")
    }
    if (check_storage("time")) {
        localStorage.setItem("time", "0")
    }
    if (check_storage("volume")) {
        localStorage.setItem("volume", "50")
    }
}