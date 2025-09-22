import Downloader from "../downloader/index.js";

export default async function check_api(downloader: Downloader) {
    if (downloader === null || downloader === undefined) { return }
    const now = new Date();
    const [now_year, now_month, now_date] = now.toISOString().split("T")[0].split("-").map((item: string) => { return Number(item) });
    const [now_hour, now_minute, now_second] = now.toISOString().split("T")[1].split(".")[0].split(":").map((item: string) => { return Number(item) });
    const keys = downloader.music.youtube.youtube_api_key;

    for (let key of keys) {
        if (!key.reach_quota) {
            continue;
        }

        const [year, month, date] = key.date_reached.split("-").map((item: string) => { return Number(item) })
        const [hour, minute, second] = key.time_reached.split(":").map((item: string) => { return Number(item) });

        if (
            new Date(year, month, date, hour, minute, second) > new Date(year, month, date, 7, 0, 0) &&
            new Date(now_year, now_month, now_date, now_hour, now_minute, now_second).getTime() > (new Date(year, month, date, 7, 0, 0).getTime() + 24 * 60 * 60 * 1000)
        ) {
            key.date_reached = "";
            key.time_reached = "";
            key.reach_quota = false;
        }
        else if (
            new Date(year, month, date, hour, minute, second) < new Date(year, month, date, 7, 0, 0) &&
            new Date(now_year, now_month, now_date, now_hour, now_minute, now_second) > new Date(year, month, date, 7, 0, 0)
        ) {
            key.date_reached = "";
            key.time_reached = "";
            key.reach_quota = false;
        }
    }
    return keys;
}