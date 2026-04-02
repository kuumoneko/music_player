import { exec } from "node:child_process";
import { rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import download from "./download";
import seven from "7zip-min";

/**
 *  Update yt-dlp
 */
export function Update_yt_dlp() {
    return new Promise((resolve, reject) => {
        exec("cd bin && yt-dlp.exe -U", (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(stderr);
            }
            resolve(stdout);
        });
    });
}

/**
 * Get latest ffmpeg version
 * @returns string
 */
function checkForUpdate_ffmpeg(): Promise<string> {
    return new Promise((resolve, reject) => {
        exec("cd bin && ffmpeg.exe -version", (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(stderr);
            } else {
                const firstLine = stdout.split("\n")[0];
                const buildVersion =
                    "ffmpeg-" + firstLine.split("version ")[1].split("-www")[0];
                resolve(buildVersion);
            }
        });
    });
}

const folderPath = resolve(import.meta.path.split(import.meta.file)[0], "..")

/**
 * Update ffmpeg and ffprobe
 */
export async function Update_ffmpeg() {
    const buildVersion = await checkForUpdate_ffmpeg();

    let fileName = "";
    const download_url =
        "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-essentials.7z";
    const response = await fetch(download_url);
    fileName = response.url
        .split("https://www.gyan.dev/ffmpeg/builds/packages/")[1]
        .split(".7z")[0];
    if (buildVersion !== fileName) {
        rmSync(resolve(folderPath, "bin", "ffmpeg.exe"), { force: true });
        rmSync(resolve(folderPath, "bin", "ffprobe.exe"), { force: true });

        if (!existsSync(resolve(folderPath, "ffmpeg-git-essentials.7z"))) {
            console.log("Downloading FFMPEG...");
            const res = await fetch(response.url);
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            writeFileSync(
                resolve(folderPath, "ffmpeg-git-essentials.7z"),
                buffer,
            );

            await download(response.url, resolve(folderPath, "ffmpeg-git-essentials.7z"), 4);
            console.log("downloaded FFMPEG.");
        }
        seven.config({
            binaryPath: resolve(
                folderPath,
                "node_modules",
                "7zip-bin",
                "win",
                "x64",
                "7za.exe",
            ),
        });
        seven.unpack(
            resolve(folderPath, "ffmpeg-git-essentials.7z"),
            resolve(folderPath, "ffmpeg"),
            (err) => {
                if (err) {
                    console.error("Error extracting files:", err);
                } else {
                    console.log("Files extracted successfully.");
                    mkdirSync(resolve(folderPath, "bin"), {
                        recursive: true,
                    });
                    const binDir = resolve(
                        folderPath,
                        "ffmpeg",
                        fileName,
                        "bin",
                    );
                    writeFileSync(
                        resolve(folderPath, "bin", "ffmpeg.exe"),
                        readFileSync(resolve(binDir, "ffmpeg.exe")),
                    );
                    writeFileSync(
                        resolve(folderPath, "bin", "ffprobe.exe"),
                        readFileSync(resolve(binDir, "ffprobe.exe")),
                    );
                    rmSync(resolve(folderPath, "ffmpeg"), {
                        recursive: true,
                    });
                    rmSync(resolve(folderPath, "ffmpeg-git-essentials.7z"));
                }
            },
        );
    } else {
        console.log("ffmpeg and ffprobe found or been up to date.");
    }
}
