import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

// Shared state to track total downloaded bytes across all connections
let totalDownloadedBytes = 0;
let totalFileSize = 0;
let startTime = 0;

/**
 * Formats bytes into human-readable sizes (MB, GB, etc.)
 */
function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Draws a real-time progress bar in the console using carriage return (\r)
 */
function drawProgressBar() {
    const percentage = totalFileSize === 0 ? 0 : (totalDownloadedBytes / totalFileSize) * 100;
    const barLength = 30;
    const filledLength = Math.round((barLength * percentage) / 100);
    const bar = '='.repeat(filledLength) + '-'.repeat(barLength - filledLength);

    // Calculate Speed
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    let speed = 0;
    if (elapsedSeconds > 0) {
        speed = totalDownloadedBytes / elapsedSeconds;
    }

    process.stdout.write(
        `\r[${bar}] ${percentage.toFixed(2)}% | Speed: ${formatBytes(speed)}/s | Downloaded: ${formatBytes(totalDownloadedBytes)} / ${formatBytes(totalFileSize)}   `
    );
}

/**
 * Downloads a chunk of a file and tracks its progress
 */
async function downloadChunk(url: string, start: number, end: number, destPath: string, signal: AbortSignal) {
    const response = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal
    });

    if (!response.ok) {
        throw new Error(`Chunk failed: ${response.status} ${response.statusText}`);
    }

    const fileStream = fs.createWriteStream(destPath, { flags: 'r+', start });
    const nodeReadableStream = Readable.fromWeb(response.body as any);

    // This is a "passthrough" stream that just counts the bytes as they fly by
    const progressStream = new Transform({
        transform(chunk, _encoding, callback) {
            totalDownloadedBytes += chunk.length;
            drawProgressBar();
            callback(null, chunk); // Pass the chunk along to the file stream
        }
    });

    // Pipeline: Internet -> Progress Tracker -> Hard Drive
    await pipeline(nodeReadableStream, progressStream, fileStream);
}

/**
 * The Main Downloader Function
 */
export default async function download(url: string, destPath: string, connections = 4) {
    const abortController = new AbortController();
    totalDownloadedBytes = 0; // Reset for new downloads

    try {
        console.log('Probing server...');
        const headRes = await fetch(url, { method: 'HEAD' });

        const acceptRanges = headRes.headers.get('accept-ranges');
        const contentLength = headRes.headers.get('content-length');

        if (acceptRanges !== 'bytes' || !contentLength) {
            console.warn('Server does not support multi-part downloading. Falling back to single stream...');
            return; // You can plug the fallback function here from the previous script
        }

        totalFileSize = parseInt(contentLength, 10);
        console.log(`File size: ${formatBytes(totalFileSize)}`);
        console.log(`Pre-allocating space on NVMe drive and starting ${connections} connections...\n`);

        // 1. Pre-allocate the file
        const fileHandle = await fsPromises.open(destPath, 'w');
        await fileHandle.truncate(totalFileSize);
        await fileHandle.close();

        // 2. Calculate chunk ranges
        const chunkSize = Math.floor(totalFileSize / connections);
        const downloadPromises = [];
        startTime = Date.now();
        for (let i = 0; i < connections; i++) {
            const start = i * chunkSize;
            const end = i === connections - 1 ? totalFileSize - 1 : (start + chunkSize - 1);

            downloadPromises.push(
                downloadChunk(url, start, end, destPath, abortController.signal)
            );
        }

        // 3. Wait for all chunks to finish
        await Promise.all(downloadPromises);

        console.log(`\n\nSuccess! File fully downloaded to: ${destPath}`);

    } catch (error: any) {
        abortController.abort();
        console.error('\n\nDownload failed:', error.message);

        if (fs.existsSync(destPath)) {
            console.log('Cleaning up incomplete file...');
            fs.unlinkSync(destPath);
        }
    }
}