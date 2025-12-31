import fetchdata from "./fetch.ts";

export default async function add_to_download(source: string, mode: string, id: string, name: string) {
    const res = await fetchdata("/profile/download", "GET");
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
    await fetchdata("/profile/download", "POST", {
        download: res
    })
}