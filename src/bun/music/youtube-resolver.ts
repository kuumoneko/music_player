import { writeLogs, getUserData, writeUserData } from "../db";

const YT_API_BASE = "https://www.youtube.com/youtubei/v1";
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

interface YTFormat {
    url?: string;
    bitrate?: number;
    audioChannels?: number;
    width?: number;
    cipher?: string;
    signatureCipher?: string;
    mimeType?: string;
    contentLength?: string;
}

interface YTStreamingData {
    formats?: YTFormat[];
    adaptiveFormats?: YTFormat[];
}

export interface ResolvedTrack {
    url: string;
    title: string;
    artist: string;
    duration: number;
    thumbnailUrl: string;
    mimeType: string;
    bitrate: number;
    contentLength?: number;
}

export class YoutubeResolver {
    private visitorData = "";
    private signatureTimestamp: number;
    private ready = false;
    private persisted = false;

    constructor() {
        this.signatureTimestamp = getUserData("ytSignatureTimestamp") ?? 20584;
    }

    async ensureSession(): Promise<void> {
        if (this.ready) return;
        try {
            const res = await fetch(`${YT_API_BASE}/config?prettyPrint=false`, {
                method: "POST",
                body: JSON.stringify({
                    context: { client: { clientName: "WEB", clientVersion: "2.20260515.01.00", hl: "en", gl: "US" } },
                }),
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            this.visitorData = data?.responseContext?.visitorData || "";
            const fetched = data?.responseContext?.signatureTimestamp;
            if (fetched) {
                this.signatureTimestamp = fetched;
                if (!this.persisted) {
                    writeUserData("ytSignatureTimestamp", fetched);
                    this.persisted = true;
                }
            }
            this.ready = true;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `YoutubeResolver session failed: ${message}` }]);
        }
    }

    async resolveUrl(videoId: string): Promise<string | null> {
        try {
            await this.ensureSession();
            if (!this.visitorData) return null;

            const result = await this.resolveOnce(videoId);
            if (result) return result;

            this.ready = false;
            await this.ensureSession();
            return this.resolveOnce(videoId);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `YoutubeResolver resolveUrl failed: ${message}` }]);
            return null;
        }
    }

    async resolveFull(videoId: string): Promise<ResolvedTrack | null> {
        try {
            await this.ensureSession();
            if (!this.visitorData) return null;

            const data = await this.fetchPlayer(videoId);
            if (!data) return null;

            const vd = data?.videoDetails;
            if (!vd) return null;

            const sd = data?.streamingData as YTStreamingData | undefined;
            if (!sd) return null;

            const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
            const best = all
                .filter((f: YTFormat) => (f.audioChannels ?? 0) > 0 && !f.width)
                .sort((a: YTFormat, b: YTFormat) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
            if (!best) return null;

            let url = best.url || "";
            if (!url && (best.cipher || best.signatureCipher)) {
                const p = new URLSearchParams(best.cipher || best.signatureCipher || "");
                const baseUrl = p.get("url");
                const sp = p.get("sp") || "signature";
                const sig = p.get("s");
                if (baseUrl && sig) url = `${baseUrl}&${sp}=${sig}`;
            }
            if (!url) return null;

            let contentLength: number | undefined;
            if (best.contentLength) {
                contentLength = parseInt(best.contentLength, 10);
            } else {
                try {
                    const head = await fetch(url, { method: "HEAD" });
                    const cl = head.headers.get("content-length");
                    if (cl) contentLength = parseInt(cl, 10);
                } catch { }
            }

            return {
                url,
                title: vd.title ?? "Unknown",
                artist: vd.author ?? "Unknown Artist",
                duration: parseInt(vd.lengthSeconds ?? "0", 10),
                thumbnailUrl:
                    vd.thumbnail?.thumbnails?.at?.(-1)?.url ??
                    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                mimeType: best.mimeType ?? "audio/webm",
                bitrate: best.bitrate ?? 0,
                contentLength,
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `YoutubeResolver resolveFull failed: ${message}` }]);
            return null;
        }
    }

    private async resolveOnce(videoId: string): Promise<string | null> {
        const data = await this.fetchPlayer(videoId);
        if (!data) return null;

        const sd = data?.streamingData as YTStreamingData | undefined;
        if (!sd) return null;

        const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
        const best = all
            .filter((f: YTFormat) => (f.audioChannels ?? 0) > 0 && !f.width)
            .sort((a: YTFormat, b: YTFormat) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
        if (!best) return null;

        if (best.url) return best.url;
        const cipher = best.cipher || best.signatureCipher;
        if (cipher) {
            const p = new URLSearchParams(cipher);
            const baseUrl = p.get("url");
            const sp = p.get("sp") || "signature";
            const sig = p.get("s");
            if (baseUrl && sig) return `${baseUrl}&${sp}=${sig}`;
        }
        return null;
    }

    private async fetchPlayer(videoId: string): Promise<any | null> {
        const res = await fetch(`${YT_API_BASE}/player?prettyPrint=false&alt=json`, {
            method: "POST",
            body: JSON.stringify({
                videoId,
                racyCheckOk: true,
                contentCheckOk: true,
                playbackContext: {
                    contentPlaybackContext: {
                        vis: 0,
                        splay: false,
                        lactMilliseconds: "-1",
                        signatureTimestamp: this.signatureTimestamp,
                    },
                },
                context: {
                    client: {
                        hl: "en",
                        gl: "US",
                        visitorData: this.visitorData,
                        clientName: "ANDROID_VR",
                        clientVersion: "0.1",
                        osName: "Android",
                        osVersion: "14",
                        platform: "MOBILE",
                    },
                    user: { enableSafetyMode: false, lockedSafetyMode: false },
                    request: { useSsl: true, internalExperimentFlags: [] },
                },
            }),
            headers: { "Content-Type": "application/json" },
        });
        return await res.json();
    }
}
