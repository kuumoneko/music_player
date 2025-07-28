import { spawn } from "node:child_process";
import { mkdir, rename, rm } from 'node:fs/promises';
import { basename, join } from "node:path";

const FFMPEG_DOWNLOAD_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z'; // Replace with the actual URL
const DOWNLOAD_FILENAME = 'ffmpeg.7z';

function get_version(): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(`curl -I ${FFMPEG_DOWNLOAD_URL}`,
            [], {
            stdio: "pipe",
            shell: true
        })
        let contentlength = "";
        child.stdout.on('data', (data: Buffer) => {
            // console.log(data.toString() + "\n");
            const str = data.toString();
            // console.log(str.includes("Location"))
            if (str.includes("Location")) {
                contentlength = str
                    .split("\n")
                    .find((data: string) => { return data.includes("Location") })
                    ?.split("Location:")[1]
                    .split(" ")[1]
                    .split("\r")[0] as string
            }
        })
        child.on("close", () => {
            resolve(contentlength);
        })
        child.on("error", (err) => {
        })
    })
}

async function moveFile(sourceFilePath: string, destinationDirectoryPath: string) {
    try {

        try {
            await mkdir(destinationDirectoryPath, { recursive: true });
        }
        catch (e) {

        }
        // 2. Get the base name of the file (e.g., 'myFile.txt' from '/path/to/myFile.txt')
        const fileName = basename(sourceFilePath);

        // 3. Construct the full destination path for the file
        const destinationFilePath = join(destinationDirectoryPath, fileName);

        // 4. Move the file using fs.rename()
        // This is an atomic operation on the same volume, or a copy+delete on different volumes.
        await rename(sourceFilePath, destinationFilePath);

        console.log(`Successfully moved: ${sourceFilePath} to ${destinationFilePath}`);
    } catch (error) {
        throw error; // Re-throw to allow calling function to handle
    }
}


async function unzip(path: string) {
    const child = spawn(`${path}\\support\\7z.exe e "${path}\\temping\\ffmpeg.7z" -o"${path}\\temping\\ffmpeg"`, { stdio: "inherit", shell: true })

    child.on('close', async () => {
        const paths = [
            join(`${path}\\temping\\ffmpeg`, 'ffmpeg.exe'),
            join(`${path}\\temping\\ffmpeg`, 'ffprobe.exe'),
            join(`${path}\\temping\\ffmpeg`, 'ffplay.exe'),
        ]

        for (const ffmpeg of paths) {
            await moveFile(ffmpeg, `${path}\\support\\ffmpeg`)
        }

        await rm(`${path}\\temping`, { recursive: true, force: true });
    })
}

export default async function download_ffmpeg(path: string) {
    const datalength: string = await get_version();
    console.log(datalength);

    const child = spawn(`curl -L -C - -# -o ${`${path}\\temping\\` + DOWNLOAD_FILENAME}  ${FFMPEG_DOWNLOAD_URL}`, [
    ],
        {
            stdio: "inherit",
            shell: true
        }
    )

    child.on("close", async () => {
        await unzip(path);
    })

}