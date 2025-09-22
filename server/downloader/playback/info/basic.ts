/**
 * Get the HTML5 player url
 */
export default async function Basic_Info(id: string): Promise<{ html5: string, formats: any }> {
    const youtube = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en&bpctr=${Math.ceil(Date.now() / 1000)}&has_verified=1`);
    const temp = await youtube.text();
    const temping = (/<script\s+src="([^"]+)"(?:\s+type="text\/javascript")?\s+name="player_ias\/base"\s*>|"jsUrl":"([^"]+)"/.exec(temp)) as any[]

    const html5web: string = (temping[0] ?? temping[1]).split(":")[1].split("\"")[1];

    const html5 = new URL(html5web, "https://www.youtube.com");

    const url = `https://youtubei.googleapis.com/youtubei/v1/player`;

    const getPlaybackContext = async (url: string) => {
        const res = await fetch(url);
        const data = await res.text();
        const mo = data.match(/(signatureTimestamp|sts):(\d+)/);
        return {
            html5Preference: "HTML5_PREF_WANTS",
            signatureTimestamp: mo?.[2],
        }
    }
    // // const a = `${url}&hl=en&bpctr=${Math.ceil(Date.now() / 1000)}&has_verified=1`
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Format-Version": "2",
        },
        body: JSON.stringify({
            context: {
                client: {
                    clientName: "WEB_EMBEDDED_PLAYER",
                    clientVersion: "1.20240723.01.00",
                    hl: "en",
                    timeZone: "UTC",
                    utcOffsetMinutes: 0
                }
            },
            videoId: id,
            playbackContext: {
                contentPlaybackContext: getPlaybackContext(html5.toString())
            },
            contentCheckOk: true,
            racyCheckOk: true
        }),

    });
    const data = await res.text();
    const { streamingData } = JSON.parse(data);
    const { formats, adaptiveFormats }: { formats: any[], adaptiveFormats: any[] } = streamingData;


    if (formats.length === 0 && adaptiveFormats.length === 0) {
        throw new Error("No formats found")
    }


    return {
        html5: html5.toString(),
        formats: formats.concat(adaptiveFormats).filter((item: { mimeType: string, itag: number }) => { return item.mimeType.includes("audio") && item.itag === 251 })
    };
}