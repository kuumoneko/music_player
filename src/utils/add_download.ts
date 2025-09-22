import fetch_profile, { LocalStorageKeys } from "./localStorage";

export default async function add_to_download(source: string, mode: string, id: string, name: string) {
    const res = await fetch_profile("get", LocalStorageKeys.download);
    if (
        res.findIndex((itemm: any) => {
            return (
                itemm.source == source &&
                itemm.mode == mode &&
                itemm.id === id
            );
        }) != -1
    ) {
        return;
    }
    res.push({
        name: name,
        source: source,
        mode: mode,
        id: id,
    });
    await fetch_profile("write", LocalStorageKeys.download, res)
}