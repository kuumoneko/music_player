import { INNERTUBE_CLIENT_VERSION, INNERTUBE_USER_AGENT, ANDROID_CLIENT_VERSION, IOS_CLIENT_VERSION } from "../../../shared/constants.ts";
import { ytSession } from "./session.ts";
import { MusicType, MusicSource, Track } from "../../../shared/types.ts";
import { extractSearchContents, ensureHttps } from "./InnerTube/parser.ts";
import { writeLogs } from "../../db/index.ts";

const INNERTUBE_BASE = "https://www.youtube.com/youtubei/v1";

const SEARCH_PARAMS: Record<string, string> = {
    [MusicType.Track]: "EgIQAQ%3D%3D",
    [MusicType.Artist]: "EgIQAg%3D%3D",
    [MusicType.Playlist]: "EgIQAw%3D%3D",
};

export interface ResolveResult {
    url: string | null;
    error?: string;
}

interface YtFormat {
    url?: string;
    bitrate?: number;
    audioChannels?: number;
    width?: number;
    cipher?: string;
    signatureCipher?: string;
}

export default class Youtube {
    private async fetchStream(videoId: string, attempt: number): Promise<ResolveResult> {
        const session = await ytSession.ensure();

        const isIos = attempt === 2;
        const client: Record<string, unknown> = isIos
            ? {
                clientName: "IOS",
                clientVersion: IOS_CLIENT_VERSION,
                deviceModel: "iPhone16,2",
                osName: "iPhone",
                osVersion: "18.5.0.0",
                hl: "en",
                gl: "US",
                visitorData: session.visitorData,
            }
            : {
                clientName: "ANDROID",
                clientVersion: ANDROID_CLIENT_VERSION,
                androidSdkVersion: 34,
                hl: "en",
                gl: "US",
                visitorData: session.visitorData,
            };

        const body: Record<string, unknown> = {
            videoId,
            context: { client },
            contentCheckOk: true,
            racyCheckOk: true,
        };

        const url = new URL(`${INNERTUBE_BASE}/player`);
        url.searchParams.set("prettyPrint", "false");
        if (session.apiKey) url.searchParams.set("key", session.apiKey);

        const headers: Record<string, string> = {
            "content-type": "application/json",
            "accept": "application/json",
            "accept-language": "en-US,en;q=0.9",
            "user-agent": INNERTUBE_USER_AGENT,
            "origin": "https://www.youtube.com",
        };
        if (session.cookies) {
            headers["cookie"] = session.cookies;
        }

        const res = await fetch(url.toString(), {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            return { url: null, error: `HTTP ${res.status}` };
        }
        const data = await res.json();

        const ps = data?.playabilityStatus;
        if (ps?.reason) {
            // Permanent playability failure (removed/unavailable video) —
            // retrying cannot help, fail fast.
            return { url: null, error: ps.reason };
        }

        if (!data?.streamingData) {
            return { url: null, error: ps?.reason || ps?.status || "No streaming data" };
        }
        const sd = data.streamingData;

        const muxed = (sd.formats || []).filter((f: YtFormat) => f.url);
        if (muxed.length > 0) return { url: muxed[0].url };

        const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
        const best = all
            .filter((f: YtFormat) => (f.audioChannels ?? 0) > 0 && !f.width)
            .sort((a: YtFormat, b: YtFormat) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
        if (best) {
            if (best.url) return { url: best.url };
            const cipher = best.cipher || best.signatureCipher;
            if (cipher) {
                const p = new URLSearchParams(cipher);
                const baseUrl = p.get("url");
                const sp = p.get("sp") || "signature";
                const sig = p.get("s");
                if (baseUrl && sig) return { url: `${baseUrl}&${sp}=${sig}` };
            }
        }

        if (data.videoDetails?.isLive || data.videoDetails?.isLiveContent) {
            const manifest = sd.hlsManifestUrl ?? sd.dashManifestUrl ?? null;
            if (manifest) return { url: manifest };
        }

        return { url: null, error: "No playable format found" };
    }

    async resolveStreamUrl(videoId: string): Promise<ResolveResult> {
        const MAX_ATTEMPTS = 3;
        let lastError: string | undefined;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const result = await this.fetchStream(videoId, attempt);
                if (result.url) return result;
                lastError = result.error;
                if (attempt === 2) {
                    ytSession.invalidate();
                    try {
                        await ytSession.ensure();
                    } catch {
                        // keep going with whatever session state we have
                    }
                }
                if (attempt < MAX_ATTEMPTS) {
                    writeLogs([{ type: "info", message: `resolveStreamUrl [${videoId}] attempt ${attempt} failed, retrying...` }]);
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                writeLogs([{ type: "info", message: `resolveStreamUrl [${videoId}] attempt ${attempt} threw: ${msg}` }]);
                lastError = msg;
                if (attempt < MAX_ATTEMPTS) {
                    writeLogs([{ type: "info", message: `resolveStreamUrl [${videoId}] retrying attempt ${attempt + 1}...` }]);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
        writeLogs([{ type: "error", message: `resolveStreamUrl [${videoId}] all ${MAX_ATTEMPTS} attempts failed` }]);
        return { url: null, error: lastError };
    }

    async browse(browseId: string): Promise<any> {
        const url = new URL(`${INNERTUBE_BASE}/browse`);
        url.searchParams.set("prettyPrint", "false");

        const body = JSON.stringify({
            browseId,
            context: {
                client: {
                    clientName: "WEB",
                    clientVersion: INNERTUBE_CLIENT_VERSION,
                    hl: "en",
                    gl: "US",
                },
            },
        });

        const res = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "accept": "application/json",
                "user-agent": INNERTUBE_USER_AGENT,
            },
            body,
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            console.error(`browse [${browseId}]: HTTP ${res.status}`);
            return null;
        }
        return res.json();
    }

    async searchAll(query: string, type: MusicType): Promise<{ tracks: Track[]; playlists: any[]; artists: any[] }> {
        const session = await ytSession.ensure().catch(() => null);

        const client: Record<string, unknown> = {
            clientName: "WEB",
            clientVersion: INNERTUBE_CLIENT_VERSION,
            hl: "en",
            gl: "US",
            ...(session?.visitorData ? { visitorData: session.visitorData } : {}),
        };

        const body: Record<string, unknown> = {
            query,
            context: { client },
            params: SEARCH_PARAMS[type] ?? "",
        };

        const url = new URL(`${INNERTUBE_BASE}/search`);
        url.searchParams.set("prettyPrint", "false");
        if (session?.apiKey) url.searchParams.set("key", session.apiKey);

        const headers: Record<string, string> = {
            "content-type": "application/json",
            "accept": "application/json",
            "accept-language": "en-US,en;q=0.9",
            "user-agent": INNERTUBE_USER_AGENT,
            "origin": "https://www.youtube.com",
        };
        if (session?.cookies) {
            headers["cookie"] = session.cookies;
        }

        const res = await fetch(url.toString(), {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
            return { tracks: [], playlists: [], artists: [] };
        }
        const data = await res.json();
        const items = extractSearchContents(data);

        const tracks: Track[] = [];
        const playlists: any[] = [];
        const artists: any[] = [];

        for (const item of items) {
            if (item.type === "video") {
                tracks.push({
                    source: MusicSource.Youtube,
                    id: item.id,
                    name: item.title,
                    artist: item.artist ? [{ id: "", name: item.artist }] : [],
                    thumbnail: ensureHttps(item.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`),
                    duration: (item.duration ?? 0) * 1000,
                    releasedDate: "",
                });
            } else if (item.type === "playlist") {
                playlists.push({
                    source: MusicSource.Youtube,
                    id: item.id,
                    name: item.title,
                    thumbnail: ensureHttps(item.thumbnails?.[0]?.url ?? ""),
                    duration: 0,
                });
            } else if (item.type === "channel") {
                artists.push({
                    source: MusicSource.Youtube,
                    id: item.id,
                    name: item.title ?? item.name ?? "",
                    thumbnail: ensureHttps(item.thumbnails?.[0]?.url ?? ""),
                    tracks: [],
                    playlistId: item.id ? "UU" + item.id.slice(2) : "",
                });
            }
        }

        return { tracks, playlists, artists };
    }

    async getVideoDetails(videoId: string): Promise<any | null> {
        const session = await ytSession.ensure();

        const body: Record<string, unknown> = {
            videoId,
            context: {
                client: {
                    clientName: "ANDROID",
                    clientVersion: ANDROID_CLIENT_VERSION,
                    androidSdkVersion: 34,
                    hl: "en",
                    gl: "US",
                    visitorData: session.visitorData,
                },
            },
            contentCheckOk: true,
            racyCheckOk: true,
        };

        const url = new URL(`${INNERTUBE_BASE}/player`);
        url.searchParams.set("prettyPrint", "false");
        if (session.apiKey) url.searchParams.set("key", session.apiKey);

        const headers: Record<string, string> = {
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": INNERTUBE_USER_AGENT,
            "origin": "https://www.youtube.com",
        };
        if (session.cookies) {
            headers["cookie"] = session.cookies;
        }

        const res = await fetch(url.toString(), { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) return null;
        return res.json();
    }

    async browsePlaylist(playlistId: string): Promise<any | null> {
        return this.browse(`VL${playlistId}`);
    }

    async getChannelInfo(channelId: string): Promise<{ name: string; thumbnail: string } | null> {
        const data = await this.browse(channelId);
        if (!data) return null;

        try {
            const header = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.title?.dynamicTextViewModel?.text?.content
                ?? data?.header?.c4TabbedHeaderRenderer?.title
                ?? data?.metadata?.channelMetadataRenderer?.title
                ?? "";
            const avatar = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url
                ?? data?.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails?.[0]?.url
                ?? data?.metadata?.channelMetadataRenderer?.avatar?.thumbnails?.[0]?.url
                ?? "";
            if (header || avatar) {
                return { name: header, thumbnail: ensureHttps(avatar) };
            }
        } catch {
            // fall through
        }
        return null;
    }
}
