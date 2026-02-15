import { exec, spawn } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import seven from "7zip-min";
import readline from "readline";

const folderPath = join(import.meta.url, "..").split(".\\file:\\")[1];

function checkForUpdate_ffmpeg() {
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

/**
 * Update ffmpeg and ffprobe
 */
async function Update_ffmpeg() {
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

/**
 *  Update yt-dlp
 */
function Update_yt_dlp() {
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

function Build_Vite() {
    return new Promise((resolve, reject) => {
        exec("npx vite build", (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(stderr);
            } else {
                console.log(stdout);
                resolve(stdout);
            }
        });
    });
}

let firstRender = true;
let isDone = false;

function chose() {
    return new Promise((resolve, reject) => {
        const options = ["yes", "no"];
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        let selectedIndex = 0;

        const render = () => {
            // Move cursor to top-left and clear from cursor down
            if (!firstRender) {
                // Move cursor up (options length + 2 lines for header/spacing)
                process.stdout.write(`\u001b[${options.length + 3}A`);
            }
            firstRender = false;
            console.log(
                "Do you want to release on Gihub in this build process?",
            );
            console.log("Use ↑/↓ to select, Enter to confirm:\n");

            options.forEach((option, index) => {
                if (index === selectedIndex) {
                    // Bold and Blue (ANSI codes)
                    process.stdout.write(
                        `\x1b[34m\x1b[1m  > ${option}\x1b[0m\n`,
                    );
                } else {
                    process.stdout.write(`    ${option}\n`);
                }
            });
        };
        process.stdin.on("keypress", (str, key) => {
            if ((key.ctrl && key.name === "c") || isDone) {
                return;
            }

            switch (key.name) {
                case "up":
                    selectedIndex =
                        selectedIndex > 0
                            ? selectedIndex - 1
                            : options.length - 1;
                    render();
                    break;
                case "down":
                    selectedIndex =
                        selectedIndex < options.length - 1
                            ? selectedIndex + 1
                            : 0;
                    render();
                    break;
                case "return":
                    process.stdout.write(
                        `\nSelection confirmed: ${options[selectedIndex]}\n`,
                    );
                    resolve(options[selectedIndex] === "yes");
                    isDone = true;
                    break;
            }
        });

        render();
    });
}

function Build(isRelease) {
    return new Promise((resolve, reject) => {
        const temp = spawn(
            `npx electron-builder -c build.json --win --x64 -p ${isRelease ? "always" : "never"}`,
            { stdio: "inherit", shell: true },
        );

        temp.on("close", (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                reject(false);
            }
        });
    });
}

async function CheckForUpdate() {
    try {
        await Update_ffmpeg();
        await Update_yt_dlp();
        await Build_Vite();
        const isRelease = await chose();
        await Build(isRelease);
        console.log("Done.");
        process.exit(0);
    } catch (e) {
        console.error(e);
    }
}

CheckForUpdate();
