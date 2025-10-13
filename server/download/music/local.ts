import ffmpeg from "fluent-ffmpeg"
import { PassThrough } from "node:stream"

export class Local {
    constructor() { }

    get_Thumbnail(path: string): Promise<string> {
        return new Promise((resolve) => {
            const imageStream = new PassThrough();
            let chunks: any[] = [];

            imageStream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            imageStream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64Image = buffer.toString('base64');
                resolve(`data:image/jpeg;base64,${base64Image}`)
            });

            ffmpeg(path)
                .outputFormat('mjpeg')
                .frames(1)
                .output(imageStream)
                .on('error', (err) => {
                    console.error('Error extracting thumbnail:', err);
                })
                .run();
        })
    }

    async parseFile(file: string): Promise<{
        title: string, artist: string, duration: number, thumbnail: string
    }> {
        return new Promise((resolve, reject) => {
            try {
                ffmpeg.ffprobe(file, async (err, metadata) => {
                    if (err) {
                        console.error('Error while probing file:', err);
                        return;
                    }

                    const duration = metadata.format.duration;
                    const tags = metadata.format.tags;
                    const title = tags ? tags.title : 'N/A';
                    const artist = tags ? tags.artist : 'N/A';
                    const thumbnail = await this.get_Thumbnail(file);

                    resolve({
                        title: title as string,
                        artist: artist as string,
                        duration: duration as number,
                        thumbnail: thumbnail
                    })
                })
            }
            catch (e) {
                reject(e)
            }
        })
    }
}