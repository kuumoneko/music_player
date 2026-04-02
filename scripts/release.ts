import { readdirSync } from "fs";
import { basename, resolve } from "node:path";
import { config } from "dotenv";

config();
const GITHUB_TOKEN = process.env["GH_TOKEN"];
const OWNER = process.env["GHUSERNAME"];
const REPO = process.env["REPO"];
const workSpace = resolve(import.meta.path.split(import.meta.file)[0], "..")

const { version } = await Bun.file(resolve(workSpace, "artifacts", "stable-win-x64-update.json")).json()
const TAG = `v${version}`;


async function uploadDraftRelease() {
    if (!GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN in .env file.");

    console.log(`Creating Draft Release ${TAG}...`);

    console.log(OWNER, ' ', REPO)
    const releaseRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
        },
        body: JSON.stringify({
            tag_name: TAG,
            name: `${TAG}`,
            draft: true,
        }),
    });

    if (!releaseRes.ok) throw new Error(`Failed to create release: ${await releaseRes.text()}`);

    const releaseData = await releaseRes.json();
    const releaseId = releaseData.id;
    console.log(`Draft release created! ID: ${releaseId}`);

    const files = [
        resolve(workSpace, "build", "stable-win-x64", "kuumoapp-Setup.exe"),
        resolve(workSpace, "artifacts", "stable-win-x64-update.json")
    ]

    const patchFiles = readdirSync(resolve(workSpace, "artifacts")).filter(file => file.endsWith(".patch"))
    if (patchFiles.length > 0) {
        files.push(patchFiles[0])
    }

    for (const file of files) {
        // const filePath = join(BUILD_DIR, file);
        const fileData = await Bun.file(file).arrayBuffer();

        console.log(`Uploading ${file}...`);

        const uploadRes = await fetch(`https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(basename(file))}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Content-Type": "application/octet-stream",
            },
            body: fileData,
        });

        if (!uploadRes.ok) {
            console.error(`Failed to upload ${file}:`, await uploadRes.text());
        } else {
            console.log(`Successfully uploaded ${file}`);
        }
    }

    console.log(`\nDone! Check your releases page: https://github.com/${OWNER}/${REPO}/releases`);
}

uploadDraftRelease();