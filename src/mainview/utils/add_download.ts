
export default async function add_to_download(source: string, mode: string, id: string, name: string) {
    const res = await window.api.rpc.request.getProfileData("download");
    if (
        res.findIndex((itemm: { source: string, mode: string, id: string }) => {
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
        name, source, mode, id
    });
    window.api.rpc.request.setProfileData({
        key: "download",
        data: res
    })
}