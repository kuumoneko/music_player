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
    stream = "stream"
}

export function fetch_data(what: Data, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const api = (window as any).electronAPI;
        if (api) {
            if (what === Data.login) {
                api.login(data);
            }
            else if (what === Data.logout) {
                api.logout(data);
            }
            else if (what === Data.download) {
                api.download(data);
            }
            else if (what === Data.download_status) {
                api.download_status(data);
            }
            else if (what === Data.user) {
                api.user(data);
            }
            else if (what === Data.localfile) {
                api.localfile(data);
            }
            else if (what === Data.local) {
                api.local(data);
            }
            else if (what === Data.search) {
                api.search(data);
            }
            else if (what === Data.track) {
                api.track(data);
            }
            else if (what === Data.playlist) {
                api.playlist(data);
            }
            else if (what === Data.likedsongs) {
                api.likedsongs(data);
            }
            else if (what === Data.userplaylist) {
                api.user_playlists(data);
            }
            else if (what === Data.stream) {
                api.stream(data)
            }

            api.onDataReceived((data: any) => {
                console.log(data.data);
                if (data.ok) {
                    if (data.from as Data === what) {
                        resolve(data.data)
                    }

                }
                else {
                    reject(data.message)
                }

            });
        }
    })
}
