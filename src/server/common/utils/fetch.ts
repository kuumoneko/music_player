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
    new_tracks = "new_tracks"
}

export function fetch_data(what: Data, data?: any): Promise<any> {
    return new Promise(async (resolve, reject) => {

        console.log(what, ' ', data);

        const url = `http://localhost:3000/${what}`
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(data)
            })

            const response = await res.json();
            if (res.ok) {
                console.log(response.data);
                resolve(response.data)
            }
            else {
                console.error(
                    response.message
                )
                reject(response.message)
            }
        }
        catch (e) {
            console.error(e);
            reject(e);
        }
    })
}
