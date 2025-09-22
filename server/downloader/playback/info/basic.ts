/**
 * Get the HTML5 player url
 */
export default async function Basic_Info(id: string, visitorId: string): Promise<any> {
    if (!visitorId) {
        return null;
    }
    const url = `https://youtubei.googleapis.com/youtubei/v1/player`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Format-Version": "2",
            "X-Goog-Visitor-Id": visitorId
        },
        body: JSON.stringify({
            videoId: id,
            context: {
                client: {
                    clientName: "TVHTML5",
                    clientVersion: "7.20240724.13.00",
                    LOCALE: { hl: "en", timeZone: "UTC", utcOffsetMinutes: 0 },
                },
            },
        }),
    });
    const { adaptiveFormats }: { adaptiveFormats: any[] } = (await res.json()).streamingData;

    if (adaptiveFormats.length === 0) {
        throw new Error("No formats found")
    }

    return adaptiveFormats.filter((item: { mimeType: string, itag: number }) => { return item.mimeType.includes("audio") && item.itag === 251 }).at(-1)
}