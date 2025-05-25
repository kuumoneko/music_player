import { spawn } from 'node:child_process';

const REPO_OWNER = 'spotDL';
const REPO_NAME = 'spotify-downloader';
const TARGET_FILENAME = 'spot-dlp.exe';
const TARGET_ARCH_FILENAME = 'spotdl-4.2.11-win32';
// https://github.com/spotDL/spotify-downloader/releases/download/v4.2.11/spotdl-4.2.11-win32.exe

export default function downloadLatestYTDLP(path: string) {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Get the latest release information
            const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
            console.log(`Workspaceing latest release from: ${apiUrl}`);
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch release info: ${response.statusText}`);
            }

            const releaseData = await response.json();
            const latestReleaseTag = releaseData.tag_name as string;
            console.log(`Latest release tag: ${latestReleaseTag}`);
            // 2. Construct the download URL
            const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${latestReleaseTag}/spotdl-${latestReleaseTag.split("v")[1]}-win32.exe`;
            console.log(`Attempting to download from: ${downloadUrl}`);

            // 3. Download the file
            const fileResponse = await fetch(downloadUrl);

            if (!fileResponse.ok) {
                throw new Error(`Failed to download file: ${fileResponse.statusText}`);
            }

            const child = spawn(`curl -L -C - -# -o \"${path}\\include\\support\\${TARGET_FILENAME}\" \"${downloadUrl}\"`, { shell: true, stdio: "inherit" });

            child.on('close', (code: number) => {
                resolve("OK")
            })
        } catch (error) {
            reject(error)
        }
    })

}