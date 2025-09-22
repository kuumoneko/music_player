import Basic_Info from "./info/basic.js"
import DownloadURL from "./formats/index.js"
import Get_Function from "./function/index.js";

export default async function Get_playback_url(id: string) {
    let url = "";

    while (url.length === 0) {
        try {
            const { html5, formats } = await Basic_Info(id);
            const clientPromises: any[] = [];
            const [decipherScript, nTransformScript] = await Get_Function(html5)

            for (const format of formats) {
                clientPromises.push(DownloadURL(format, decipherScript, nTransformScript));
            }

            url = clientPromises[0].url;
        }
        catch {

        }
    }

    return url;
}