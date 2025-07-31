import { spawn } from "node:child_process";
import downloadLatestYTDLP, { ytdlp_get_latest_version } from './yt-dlp_download.js';

function check_ytdlp(path: string) {
    return new Promise((resolve, reject) => {

        const child = spawn(`${path}\\support\\yt-dlp.exe`, ["--version"], { stdio: "pipe" });
        let data: string = "";
        child.stdout.on('data', (dt) => {
            data += dt
            // You can process the output data here, for example, store it in a variable.
        });
        child.on('close', async () => {
            resolve(String(data))
        })
    })
}

async function ytdlp(path: string) {
    const ytdlp_current = await check_ytdlp(path);
    const ytdlp_latest = await ytdlp_get_latest_version();
    console.log(`Current: ${ytdlp_current}\nLatest: ${ytdlp_latest}`)
    if (ytdlp_latest !== ytdlp_current) {
        await downloadLatestYTDLP(path, ytdlp_latest as string);
    }
}

export default async function check_for_update(path: string) {
    await ytdlp(path);
}


// check_for_update("E:\\MDS app");
