import "../../../electron.d.ts"

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

let received_datas: any[] = []

const api = window.electronAPI;

api.onDataReceived((data: any) => {
    // console.log(data);
    if (!data.ok) {
        received_datas.push({
            from: data.from,
            message: data.message
        })
    }
    else {
        received_datas.push({
            from: data.from,
            data: data.data
        })
    }
})


function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function fetch_data(what: Data, data?: any): Promise<any> {
    return new Promise(async (resolvee, reject) => {

        // console.log(what)

        if (!api) {
            return;
        }

        // Dispatch the appropriate IPC event
        switch (what) {
            case Data.login:
                api.login(data);
                break;
            case Data.logout:
                api.logout(data);
                break;
            case Data.download:
                api.download(data);
                break;
            case Data.download_status:
                api.download_status();
                break;
            case Data.user:
                api.user();
                break;
            case Data.localfile:
                api.localfile(data);
                break;
            case Data.local:
                api.local();
                break;
            case Data.search:
                api.search(data);
                break;
            case Data.track:
                api.track(data);
                break;
            case Data.playlist:
                api.playlist(data);
                break;
            case Data.likedsongs:
                api.likedsongs(data);
                break;
            case Data.userplaylist:
                api.user_playlists();
                break;
            case Data.stream:
                api.stream(data);
                break;

        }

        while (received_datas.findIndex((item: any) => { return item.from === what }) === -1) {
            await sleep(1000);
        };

        const temp = received_datas.length - [...received_datas].reverse().findIndex((item: any) => { return item.from === what });
        const received_data: any = received_datas.at(temp - 1);
        received_datas = received_datas.filter((item: any) => { return item.from !== what });
        resolvee(received_data.data)

    })
}
