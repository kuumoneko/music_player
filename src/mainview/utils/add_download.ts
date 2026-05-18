
export default async function add_to_download(source: string, mode: string, id: string) {
    const res = await window.api.rpc.request.getUserData("downloadQueue");
    if (
        res.findIndex((itemm: string) => {
            const [sourcee, modee, idd] = itemm.split(":")
            return (
                sourcee === source &&
                modee === mode &&
                idd === id
            );
        }) != -1
    ) {
        return;
    }
    res.push(`${source}:${mode}:${id}`)
    window.api.rpc.request.setUserData({
        key: "downloadQueue",
        data: res
    })
}