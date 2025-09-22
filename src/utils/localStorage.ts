import { Data, fetch_data } from "./fetch";

export enum LocalStorageKeys {
    artists = "artists",
    playlists = "playlists",
    pin = "pin",
    download = "download",
    play = "play",
    nextfrom = "nextfrom",
    audio = "audio",
    search = "search",
    local = "local"
}

export default async function fetch_profile(mode: "get" | "write" = "get", key: LocalStorageKeys, value?: any) {
    if (mode === "get") {
        const res = await fetch_data(Data.profile, { mode: mode, key: key });
        return res;
    }
    else {
        const data = (typeof value === 'string') ? value : JSON.stringify(value);
        const res = await fetch_data(Data.profile, { mode: mode, key: key, data: data });
        return res;
    }
}