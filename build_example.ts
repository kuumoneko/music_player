import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import fs, { constants } from 'node:fs/promises';
import path from "node:path";


async function checkPathType(path: string) {
    try {
        const stats = await fs.stat(path);
        if (stats.isFile()) {
            return "file";
        } else if (stats.isDirectory()) {
            return "folder";
        } else {
            return "neither file nor folder"; // Could be a symbolic link, etc.
        }
    } catch (error: any) {
        // Handle errors like the path not existing
        if (error.code === 'ENOENT') {
            return "path does not exist";
        } else {
            console.error("Error checking path:", error);
            return "error";
        }
    }
}

async function copy(src: string, to: string): Promise<void> {
    if (src === to) {
        return;
    }
    const destinationDir = path.dirname(to);
    try {
        await fs.access(destinationDir); // Check if the directory exists
    } catch (error) {
        await fs.mkdir(destinationDir, { recursive: true }); // Create the directory if it doesn't exist
    }

    const check_src = await checkPathType(src);

    if (check_src == 'file') {
        try {
            await fs.copyFile(src, to);
            console.log('Item copied synchronously successfully!');
        } catch (err) {
            console.error('Error copying file:', err);
        }
        return;
    }
    else if (check_src == 'folder') {
        try {
            await fs.cp(src, to, { recursive: true });
            console.log('Item copied synchronously successfully!');
        } catch (err) {
            console.error('Error copying folder:', err);
        }
        return;
    }
    else {
        console.error('path is not valid!');
        return;
    }
}

async function emptyFolder(folderPath: string) {
    try {
        fs.mkdir(folderPath, { recursive: true });
        const files = await fs.readdir(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                await fs.unlink(filePath);
                console.log(`Deleted file: ${filePath}`);
            } else if (stats.isDirectory()) {
                // For emptying subdirectories, you might want to recursively call this function
                // or use fs.rm with the recursive option. Be careful with this!
                // Example using fs.rm (Node.js >= 16.14.0):
                await fs.rm(filePath, { recursive: true, force: true });
                console.log(`Deleted directory: ${filePath} (and its contents)`);
            }
        }
        console.log(`Folder "${folderPath}" emptied successfully.`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`Folder "${folderPath}" does not exist.`);

            // create folder download
            await fs.mkdir(folderPath, { recursive: true });
            console.log(`Folder "${folderPath}" created successfully.`);
        } else {
            console.error(`Error emptying folder "${folderPath}":`, error);
        }
    }
}

async function replaceInFile(filePath: string, from: string, to: string) {
    // Read the file as UTF-8 text
    let content = await fs.readFile(filePath, 'utf8');

    // Replace all occurrences
    const updated = content.replaceAll(from, to);

    // Only write if something changed
    if (updated !== content) {
        await fs.writeFile(filePath, updated, 'utf8');
        console.log(`Updated: ${path.basename(filePath)}`);
    } else {
        console.log(`No occurrences found in ${path.basename(filePath)}`);
    }
}

async function delete_files(folderPath: string, ext: string) {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            await delete_files(path.join(folderPath, entry.name), ext);
        }
        else if (entry.isFile() && path.extname(entry.name) === ext) {
            fs.unlink(path.join(folderPath, entry.name))
        }
    }
}
interface File_to_create { folderPath: string, filename: string, fileContent: string }

async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}
async function createMultipleFiles(files: File_to_create[]) {
    for (const file of files) {
        try {
            await fs.mkdir(file.folderPath, { recursive: true });
            const is_existed = await fileExists(path.join(file.folderPath, file.filename));
            if (!is_existed) {
                writeFileSync(path.join(file.folderPath, file.filename), file.fileContent);
                console.log(`file ${file.filename} created successfully!`);
            }
            else {
                console.log(`file ${file.filename} is existed!`);
            }
        } catch (err) {
            console.error('Error creating files:', err);
            throw new Error(err)
        }
    }
}

async function run() {
    await emptyFolder("./app");
    const build = spawn('npm run build_frontend', { shell: true, stdio: 'inherit' });
    build.on('close', async () => {
        const building = spawn('npm run build_backend', { shell: true, stdio: 'inherit' });
        building.on('close', async () => {
            const data = readFileSync("./server/data/youtube/endpoint.json", { encoding: "utf-8" })
            await replaceInFile("./build/index.html", "src/", "");
            await copy("./build", "./app/build");
            await delete_files("./app", ".map");
            await delete_files("./app", ".txt");
            await delete_files("./app", ".json");
            const filesToCreate: File_to_create[] = [
                { folderPath: path.join("./app", "data"), filename: "download.txt", fileContent: "" },
                { folderPath: path.join("./app", "data"), filename: "spot.txt", fileContent: "" },
                {
                    folderPath: path.join("./app", "data"), filename: "user.json", fileContent: JSON.stringify({
                        "youtube": {
                            "access_token": null,
                            "expires": null,
                            "refresh_token_expires": null,
                            "refresh_token": null,
                            "user": null
                        },
                        "spotify": {
                            "access_token": null,
                            "expires": null,
                            "refresh_token": null,
                            "user": null
                        },

                        "local": {
                            "folder": ""
                        }
                    })
                },
                {
                    folderPath: path.join("./app", "data"), filename: "system.json", fileContent: JSON.stringify(
                        {
                            "Youtube_Api_key": "Youtube Api keys",
                            "Spotify_Api_key": "Spotify Api key",
                            "Spotify_client": "Spotify Client id",
                            "web": "from client json file for credential",
                            "test_id": "Your test video id"
                        }
                    )
                },
                {
                    folderPath: path.join("./app", "data"), filename: "track.json", fileContent: JSON.stringify(
                        {
                            youtube: {},
                            spotify: {}
                        }
                    )
                },
                { folderPath: path.join("./app", "data", "localfile"), filename: "local.json", fileContent: "[]" },
                { folderPath: path.join("./app", "data", "spotify"), filename: "track.json", fileContent: "{}" },
                { folderPath: path.join("./app", "data", "youtube"), filename: "artist.json", fileContent: "{}" },
                { folderPath: path.join("./app", "data", "youtube"), filename: "playlist.json", fileContent: "{}" },
                { folderPath: path.join("./app", "data", "youtube"), filename: "user.json", fileContent: "{}" },
                { folderPath: path.join("./app", "data", "youtube"), filename: "endpoint.json", fileContent: data },
                { folderPath: path.join("./app", "data", "youtube"), filename: "track.json", fileContent: "[]" }
            ];
            createMultipleFiles(filesToCreate);
        })
    })
}

run();