export const running = () => {
    const check_storage = (id: string) => {
        return (
            localStorage.getItem(id) === null ||
            localStorage.getItem(id) === undefined
        );
    };

    if (document.referrer.includes("localhost:") === false) {
        localStorage.setItem("backward", "[]");
        localStorage.setItem("forward", "[]");
    }

    if (check_storage("playing")) {
        localStorage.setItem(
            "playing",
            JSON.stringify({
                name: "",
                artists: "",
                thumbnail: "",
                source: "",
                id: "",
                duration: "",
            })
        );
    }

    if (check_storage("play_url")) {
        localStorage.setItem(
            "play_url",
            JSON.stringify({
                id: "",
                url: "",
                source: "",
            })
        );
    }

    if (check_storage("backward")) {
        localStorage.setItem("backward", JSON.stringify([]));
    }

    if (check_storage("forward")) {
        localStorage.setItem("forward", JSON.stringify([]));
    }

    if (
        check_storage("url") ||
        localStorage.getItem("url")?.includes("localhost")
    ) {
        localStorage.setItem("url", "/");
    }

    if (check_storage("repeat")) {
        localStorage.setItem("repeat", "disable");
    }

    if (check_storage("shuffle")) {
        localStorage.setItem("shuffle", "disable");
    }

    if (check_storage("kill time")) {
        localStorage.setItem("kill time", "nosleep");
    }

    if (check_storage("search")) {
        localStorage.setItem(
            "search",
            JSON.stringify({
                query: "",
                source: "youtube",
                result: {
                    type: "",
                    tracks: [],
                },
            })
        );
    }
    if (check_storage("theme")) {
        localStorage.setItem("theme", "dark");
    }
    if (check_storage("time")) {
        localStorage.setItem("time", "0");
    }
    if (check_storage("volume")) {
        localStorage.setItem("volume", "50");
    }
};
