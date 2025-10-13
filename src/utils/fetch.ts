export enum Data {
    login = "login",
    logout = "logout",
    download = "download",
    download_status = "download_status",
    user = "user",
    localfile = "localfile",
    local = "local",
    search = "search",
    track = "track",
    playlist = "playlist",
    likedsongs = "likedsongs",
    userplaylist = "userplaylist",
    stream = "stream",
    likedartists = "likedartists",
    artist = "artist",
    auth = "auth",
    new_tracks = "new_tracks",
    profile = "profile"
}

export async function fetch_data(what: Data, data?: any): Promise<any> {

    let url = `http://localhost:3000/${what}`
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(data)
        })
        const response = await res.json();
        if (res.ok) {
            return response.data;
        }
        else {
            console.error(response.message)
            return null
        }
    }
    catch (e) {
        console.log("error ne")
        console.error(e);
        return null;
    }
}
