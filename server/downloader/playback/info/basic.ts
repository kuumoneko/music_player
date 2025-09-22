/**
 * Get the HTML5 player url
 */
export default async function Basic_Info(id: string): Promise<{ formats: any }> {
    const html5: string = `https://www.youtube.com/s/player/0e6689e2/player_ias.vflset/en_US/base.js`
    const url = `https://youtubei.googleapis.com/youtubei/v1/player`;

    const getPlaybackContext = async (url: string) => {
        const res = await fetch(url);
        const data = await res.text();
        const mo = data.match(/(signatureTimestamp|sts):(\d+)/);
        return mo?.[2];
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
                contentPlaybackContext: {
                    html5Preference: "HTML5_PREF_WANTS",
                    signatureTimestamp: await getPlaybackContext(html5)
                }
            },
            contentCheckOk: true,
            racyCheckOk: true
        }),

    });
    const { adaptiveFormats }: { adaptiveFormats: any[] } = (await res.json()).streamingData;

    if (adaptiveFormats.length === 0) {
        throw new Error("No formats found")
    }

    return {
        formats: adaptiveFormats.filter((item: { mimeType: string, itag: number }) => { return item.mimeType.includes("audio") && item.itag === 251 })
    };
}