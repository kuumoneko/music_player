import { writeLogs, getUserData, writeUserData } from "../db";
import { ytSession } from "./youtube/session.ts";

const YT_API_BASE = "https://www.youtube.com/youtubei/v1";

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
    hlsManifestUrl?: string;
    dashManifestUrl?: string;
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
        if (this.ready) {
            writeLogs([{ type: "info", message: `ensureSession: already ready, visitorData=${this.visitorData.substring(0, 20)}...` }]);
            return;
        }
        try {
            const session = await ytSession.ensure();
            this.visitorData = session.visitorData;
            this.signatureTimestamp = session.signatureTimestamp;
            if (!this.persisted) {
                writeUserData("ytSignatureTimestamp", this.signatureTimestamp);
                this.persisted = true;
            }
            this.ready = true;
            writeLogs([{ type: "info", message: `ensureSession: got visitorData=${this.visitorData.substring(0, 30)}...` }]);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `YoutubeResolver session failed: ${message}` }]);
        }
    }

    async resolveUrl(videoId: string): Promise<string | null> {
        try {
            await this.ensureSession();
            if (!this.visitorData) {
                writeLogs([{ type: "error", message: `resolveUrl: no visitorData for ${videoId}` }]);
                return null;
            }

            const result = await this.resolveOnce(videoId);
            if (result) return result;

            writeLogs([{ type: "info", message: `resolveUrl: first attempt returned null for ${videoId}, retrying...` }]);
            ytSession.invalidate();
            this.ready = false;
            await this.ensureSession();
            const retryResult = await this.resolveOnce(videoId);
            if (!retryResult) {
                writeLogs([{ type: "error", message: `resolveUrl: both attempts returned null for ${videoId}` }]);
            }
            return retryResult;
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

            const ps = data?.playabilityStatus;
            if (ps?.reason) {
                writeLogs([{ type: "error", message: `resolveFull: playabilityStatus "${ps.reason}" for ${videoId}` }]);
            }

            const vd = data?.videoDetails;
            if (!vd) return null;

            const sd = data?.streamingData as YTStreamingData | undefined;
            if (!sd) return null;

            const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
            const best = all
                .filter((f: YTFormat) => (f.audioChannels ?? 0) > 0 && !f.width)
                .sort((a: YTFormat, b: YTFormat) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

            if (best) {
                let url = best.url || "";
                if (!url && (best.cipher || best.signatureCipher)) {
                    const p = new URLSearchParams(best.cipher || best.signatureCipher || "");
                    const baseUrl = p.get("url");
                    const sp = p.get("sp") || "signature";
                    const sig = p.get("s");
                    if (baseUrl && sig) url = `${baseUrl}&${sp}=${sig}`;
                }
                if (url) {
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
                }
            }

            if (vd?.isLive || vd?.isLiveContent) {
                const url = sd.hlsManifestUrl ?? sd.dashManifestUrl ?? null;
                if (url) {
                    return {
                        url,
                        title: vd.title ?? "Unknown",
                        artist: vd.author ?? "Unknown Artist",
                        duration: 0,
                        thumbnailUrl:
                            vd.thumbnail?.thumbnails?.at?.(-1)?.url ??
                            `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                        mimeType: "application/x-mpegURL",
                        bitrate: 0,
                    };
                }
            }

            return null;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `YoutubeResolver resolveFull failed: ${message}` }]);
            return null;
        }
    }

    private async resolveOnce(videoId: string): Promise<string | null> {
        const data = await this.fetchPlayer(videoId);
        if (!data) {
            writeLogs([{ type: "error", message: `resolveOnce: fetchPlayer returned null for ${videoId}` }]);
            return null;
        }

        const ps = data?.playabilityStatus;
        if (ps?.reason) {
            writeLogs([{ type: "error", message: `resolveOnce: playabilityStatus "${ps.reason}" for ${videoId}` }]);
        }

        const vd = data?.videoDetails;
        const sd = data?.streamingData as YTStreamingData | undefined;
        if (!sd) {
            writeLogs([{ type: "error", message: `resolveOnce: no streamingData for ${videoId}. Has error?: ${!!data?.error}` }]);
            return null;
        }

        const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
        writeLogs([{ type: "info", message: `resolveOnce: ${vd?.isLive ? "live" : "normal"} ${videoId}, formats=${sd.formats?.length || 0}, adaptive=${sd.adaptiveFormats?.length || 0}` }]);

        const best = all
            .filter((f: YTFormat) => (f.audioChannels ?? 0) > 0 && !f.width)
            .sort((a: YTFormat, b: YTFormat) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

        if (best) {
            if (best.url) return best.url;
            const cipher = best.cipher || best.signatureCipher;
            if (cipher) {
                const p = new URLSearchParams(cipher);
                const baseUrl = p.get("url");
                const sp = p.get("sp") || "signature";
                const sig = p.get("s");
                if (baseUrl && sig) return `${baseUrl}&${sp}=${sig}`;
            }
        }

        if (vd?.isLive || vd?.isLiveContent) {
            const url = sd.hlsManifestUrl ?? sd.dashManifestUrl ?? null;
            writeLogs([{ type: "info", message: `resolveOnce: livestream ${videoId}, no direct audio, falling back to hls=${!!sd.hlsManifestUrl}, dash=${!!sd.dashManifestUrl}` }]);
            return url;
        }

        writeLogs([{ type: "error", message: `resolveOnce: no playable format for ${videoId}` }]);
        return null;
    }

    private async fetchPlayer(videoId: string): Promise<any | null> {
        const session = await ytSession.ensure();
        const url = new URL(`${YT_API_BASE}/player`);
        url.searchParams.set("prettyPrint", "false");
        url.searchParams.set("alt", "json");
        if (session.apiKey) url.searchParams.set("key", session.apiKey);

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session.cookies) {
            headers["cookie"] = session.cookies;
        }

        const res = await fetch(url.toString(), {
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
                        clientName: "WEB",
                        clientVersion: session.clientVersion,
                    },
                    user: { enableSafetyMode: false, lockedSafetyMode: false },
                    request: { useSsl: true, internalExperimentFlags: [] },
                },
            }),
            headers,
        });
        if (!res.ok) {
            writeLogs([{ type: "error", message: `fetchPlayer: HTTP ${res.status} ${res.statusText} for ${videoId}` }]);
        }
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            const preview = text.substring(0, 200);
            writeLogs([{ type: "error", message: `fetchPlayer: JSON parse error for ${videoId}: ${preview}` }]);
            return null;
        }
    }
}
