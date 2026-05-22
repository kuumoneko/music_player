import { Playlist, Track, Artist } from "../../shared/types.ts";
import { getPlaylist, getTracks, writeArtist, writeLogs, writePlaylist, writeTracks } from "../db/index.ts";
import deleteTracks from "../db/tracks/delete.ts";
import { getAllTracks } from "../db/index.ts";
import db from "../db/setup.ts";

const genericUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const INNERTUBE_BASE = "https://www.youtube.com/youtubei/v1";
const YT_HOME = "https://www.youtube.com";

interface Thumbnail {
    url: string;
    width: number;
    height: number;
}

interface InnerPlaylistItem {
    id: string;
    title: string;
    artist: string;
    channelId: string | null;
    duration: number;
    position: number;
    thumbnails: Thumbnail[];
}

interface InnerSearchItem {
    type: "video" | "playlist" | "channel";
    id: string;
    title: string;
    artist?: string;
    name?: string;
    thumbnails: Thumbnail[];
    duration?: number;
}

interface InnerSearchResult {
    query: string;
    type: string;
    items: InnerSearchItem[];
    estimatedResults: number;
}

export default class Youtube {
    private api_key: string | null = null;
    private clientVersion = "2.20250401.00.00";
    private inflight = new Map<string, Promise<any>>();

    constructor() { }

    private async resolveApiKey(): Promise<void> {
        if (this.api_key) return;

        const res = await fetch(YT_HOME, {
            headers: {
                "accept-language": "en-US,en;q=0.9",
                "user-agent": genericUserAgent,
            },
        });

        const html = await res.text();

        const keyMatch = html.match(/INNERTUBE_API_KEY["']?\s*:\s*["']([^"']+)["']/);
        if (keyMatch) {
            this.api_key = keyMatch[1];
        } else {
            const cfgMatch = html.match(/ytcfg\.set\s*\(\s*({.+?})\s*\)/s);
            if (cfgMatch) {
                try {
                    const cfg = JSON.parse(cfgMatch[1]);
                    if (typeof cfg.INNERTUBE_API_KEY === "string") this.api_key = cfg.INNERTUBE_API_KEY;
                } catch (e) { this.log(e.message) }
            }
        }

        const versionMatch = html.match(/INNERTUBE_CLIENT_VERSION["']?\s*:\s*["']([^"']+)["']/);
        if (versionMatch) {
            this.clientVersion = versionMatch[1];
        }

        if (!this.api_key) {
            throw new Error("Could not resolve InnerTube API key from youtube.com");
        }
    }

    private async innertubeRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
        if (!this.api_key) {
            await this.resolveApiKey();
        }

        const url = new URL(`${INNERTUBE_BASE}/${endpoint}`);
        url.searchParams.set("key", this.api_key!);
        url.searchParams.set("prettyPrint", "false");

        const payload = {
            context: {
                client: {
                    clientName: "WEB",
                    clientVersion: this.clientVersion,
                    hl: "en",
                    gl: "US",
                },
            },
            ...body,
        };

        const res = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "accept": "application/json",
                "accept-language": "en-US,en;q=0.9",
                "user-agent": genericUserAgent,
                "origin": "https://www.youtube.com",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(`InnerTube API returned ${res.status}`);
        }

        const data = (await res.json()) as T & { error?: { message?: string } };

        if (data.error) {
            throw new Error(data.error.message || "InnerTube API error");
        }

        return data as T;
    }

    private extractPlaylistTotalCount(data: any): number | null {
        try {
            const header = data?.header?.playlistHeaderRenderer;
            if (header?.numVideos) return Number(header.numVideos);
            if (header?.numVideosText?.simpleText) {
                const match = String(header.numVideosText.simpleText).match(/(\d+)/);
                if (match) return Number(match[1]);
            }
            if (header?.numVideosText?.runs) {
                for (const run of header.numVideosText.runs) {
                    const match = String(run?.text ?? "").match(/(\d+)/);
                    if (match) return Number(match[1]);
                }
            }
            if (Array.isArray(header?.stats)) {
                for (const stat of header.stats) {
                    const text = stat?.simpleText ?? stat?.runs?.[0]?.text ?? "";
                    const match = String(text).match(/(\d+)/);
                    if (match) return Number(match[1]);
                }
            }
            return null;
        } catch {
            return null;
        }
    }

    private extractPlaylistContents(data: any): any[] {
        try {
            const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
            if (!tabs?.length) return [];

            const tab = tabs[0]?.tabRenderer?.content;
            if (!tab) return [];

            const sl = tab?.sectionListRenderer?.contents;
            if (!sl?.length) return [];

            return sl[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ?? [];
        } catch {
            return [];
        }
    }

    private extractContinuationContents(data: any): any[] {
        try {
            const action = data?.onResponseReceivedCommands?.[0] ??
                data?.onResponseReceivedActions?.[0];
            return (
                action?.appendContinuationItemsAction?.continuationItems ??
                data?.continuationContents?.playlistVideoListContinuation?.contents ??
                data?.continuationContents?.sectionListContinuation?.contents ??
                []
            );
        } catch {
            return [];
        }
    }

    private extractContinuationToken(contents: any[]): string | null {
        if (!Array.isArray(contents)) return null;
        for (const item of contents) {
            const cir = item?.continuationItemRenderer;
            const ce = cir?.continuationEndpoint ?? item?.continuationEndpoint;
            if (ce?.continuationCommand?.token) return ce.continuationCommand.token;
            if (ce?.commandExecutorCommand?.commands) {
                for (const cmd of ce.commandExecutorCommand.commands) {
                    if (cmd?.continuationCommand?.token) return cmd.continuationCommand.token;
                }
            }
            const token =
                item?.continuationCommand?.token;
            if (typeof token === "string") return token;
        }
        return null;
    }

    private parsePlaylistItem(item: any, pos: number): InnerPlaylistItem | null {
        const vr = item?.playlistVideoRenderer ?? item?.playlistPanelVideoRenderer ?? item?.videoRenderer;
        if (!vr?.videoId) return null;

        const lengthStr =
            vr.lengthSeconds ??
            vr.lengthText?.simpleText ??
            vr.lengthText?.runs?.[0]?.text ??
            "";

        return {
            id: vr.videoId,
            title: vr.title?.runs?.[0]?.text ?? vr.title?.simpleText ?? "",
            artist: vr.shortBylineText?.runs?.[0]?.text ??
                vr.shortBylineText?.simpleText ??
                vr.ownerText?.runs?.[0]?.text ?? "",
            channelId: vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ??
                vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null,
            duration: parseInt(lengthStr) || 0,
            position: pos,
            thumbnails: vr.thumbnail?.thumbnails ?? [],
        };
    }

    private parseSearchItem(item: any): InnerSearchItem | null {
        if (!item) return null;

        const vr = item?.videoRenderer;
        if (vr?.videoId) {
            const lengthStr =
                vr.lengthSeconds ??
                vr.lengthText?.simpleText ??
                vr.lengthText?.runs?.[0]?.text ??
                "";
            return {
                type: "video",
                id: vr.videoId,
                title: vr.title?.runs?.[0]?.text ?? vr.title?.simpleText ?? "",
                artist: vr.ownerText?.runs?.[0]?.text ??
                    vr.shortBylineText?.runs?.[0]?.text ?? "",
                thumbnails: vr.thumbnail?.thumbnails ?? [],
                duration: parseInt(lengthStr) || 0,
            };
        }

        const pr = item?.playlistRenderer;
        if (pr?.playlistId) {
            return {
                type: "playlist",
                id: pr.playlistId,
                title: pr.title?.simpleText ?? pr.title?.runs?.[0]?.text ?? "",
                thumbnails: pr.thumbnails?.[0]?.thumbnails ?? pr.thumbnail?.thumbnails ?? [],
            };
        }

        const cr = item?.channelRenderer;
        if (cr?.channelId) {
            return {
                type: "channel",
                id: cr.channelId,
                title: cr.title?.simpleText ?? cr.title?.runs?.[0]?.text ?? "",
                name: cr.title?.simpleText ?? cr.title?.runs?.[0]?.text ?? "",
                thumbnails: cr.thumbnail?.thumbnails ?? [],
            };
        }

        return null;
    }

    private async fetchInnerSearch(query: string, type: string | null = null, limit: number = 20): Promise<InnerSearchResult> {
        if (!query?.trim()) {
            throw new Error("Search query is required");
        }

        const paramsMap: Record<string, string> = {
            video: "EgIQAQ%3D%3D",
            playlist: "EgIQAw%3D%3D",
            channel: "EgIQAg%3D%3D",
        };

        const body: Record<string, unknown> = { query: query.trim() };
        if (type && paramsMap[type]) {
            body["params"] = paramsMap[type];
        }

        const data = await this.innertubeRequest<any>("search", body);

        const results: InnerSearchResult = {
            query: query.trim(),
            type: type ?? "all",
            items: [],
            estimatedResults: parseInt(data?.estimatedResults ?? "") || 0,
        };

        const contents =
            data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
                ?.sectionListRenderer?.contents ?? [];

        for (const section of contents) {
            const itemSection = section?.itemSectionRenderer?.contents ?? [];
            for (const item of itemSection) {
                const parsed = this.parseSearchItem(item);
                if (parsed) results.items.push(parsed);
            }
        }

        let continuation = null;
        for (const section of contents) {
            continuation = this.extractContinuationToken(section?.itemSectionRenderer?.contents ?? []);
            if (continuation) break;
        }

        while (results.items.length < limit && continuation) {
            const nextData = await this.innertubeRequest<any>("browse", { continuation });

            const nextContents = this.extractContinuationContents(nextData);
            if (!nextContents?.length) break;

            for (const item of nextContents) {
                const parsed = this.parseSearchItem(
                    item?.itemSectionRenderer?.contents?.[0] ??
                    item?.richItemRenderer?.content
                );
                if (parsed) results.items.push(parsed);
            }

            continuation = this.extractContinuationToken(nextContents);
        }

        if (results.items.length > limit) {
            results.items = results.items.slice(0, limit);
        }

        return results;
    }

    // --- Public methods ---

    log(message: any) {
        writeLogs([{ type: "error", message: typeof message === "string" ? message : message?.message ?? String(message) }])
    }

    async fetch_track(ids: string[]): Promise<Track[]> {
        ids = Array.from(new Set([...ids]));
        const tracks = getTracks(ids) ?? [];
        const tracks_in_database: Track[] = tracks.filter((track: Track) => {
            return ids.findIndex(id => id === track.id) !== -1
        })

        const tracks_out_database = ids.filter(track => tracks_in_database.findIndex(trackk => trackk.id === track) === -1);
        const temp_tracks: Track[] = []

        if (tracks_out_database.length > 0) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < tracks_out_database.length; i += BATCH_SIZE) {
                const batch = tracks_out_database.slice(i, i + BATCH_SIZE);
                const results = await Promise.all(batch.map(async (id) => {
                    try {
                        const data = await this.innertubeRequest<any>("player", { videoId: id });
                        if (!data?.videoDetails) return null;
                        const vd = data.videoDetails;
                        const mf = data.microformat?.playerMicroformatRenderer ?? {};
                        return {
                            source: "youtube",
                            thumbnail: `https://i.ytimg.com/vi/${vd.videoId}/default.jpg`,
                            artist: [{ name: vd.author ?? "", id: vd.channelId ?? "" }],
                            name: vd.title ?? "",
                            id: vd.videoId,
                            duration: (parseInt(vd.lengthSeconds) || 0) * 1000,
                            releasedDate: mf.publishDate?.split("T")[0] ?? "",
                        } as Track;
                    } catch { return null; }
                }));
                for (const track of results) {
                    if (track) temp_tracks.push(track);
                }
            }
        }

        const res = [...tracks_in_database, ...temp_tracks].map(track => {
            return {
                ...track,
                thumbnail: `https://i.ytimg.com/vi/${track.id}/default.jpg`,
            }
        })

        if (res.length > 0) {
            const unavailableIds = await this.checkYoutubeTracks(res.map(t => t.id));
            const filtered = res.filter(t => !unavailableIds.includes(t.id));
            if (filtered.length > 0) {
                writeTracks(filtered)
            }
            return filtered.sort((a: Track, b: Track) => {
                return (
                    new Date(b.releasedDate).getTime() -
                    new Date(a.releasedDate).getTime()
                );
            });
        }
    }

    private ensureHttps(url: string): string {
        return url.startsWith("//") ? `https:${url}` : url;
    }

    private itemToTrack(item: InnerPlaylistItem): Track {
        return {
            source: "youtube",
            thumbnail: this.ensureHttps(item.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${item.id}/default.jpg`),
            artist: [{ name: item.artist, id: item.channelId ?? "" }],
            name: item.title,
            id: item.id,
            duration: item.duration * 1000,
            releasedDate: "",
        };
    }

    async fetch_playlist_data(id: string): Promise<Playlist> {
        const tracks: Track[] = [];
        const trackIds: string[] = [];
        const browseId = id.startsWith("VL") ? id : `VL${id}`;
        const data = await this.innertubeRequest<any>("browse", { browseId });

        let plTitle = "";
        let plThumbnails: Thumbnail[] = [];
        const oldHeader = data?.header?.playlistHeaderRenderer;
        if (oldHeader) {
            plTitle = oldHeader?.title?.simpleText ?? "";
            plThumbnails = oldHeader?.thumbnail?.thumbnails ?? oldHeader?.ogPhoto?.thumbnails ?? [];
        } else {
            const ph = data?.header?.pageHeaderRenderer;
            const vm = ph?.content?.pageHeaderViewModel;
            plTitle = vm?.title?.dynamicTextViewModel?.text?.content ?? ph?.pageTitle ?? "";
            const mth = data?.microformat?.microformatDataRenderer?.thumbnail;
            plThumbnails = mth?.thumbnails ?? [];
        }

        let thumbnail = plThumbnails?.[0]?.url ? this.ensureHttps(plThumbnails[0].url) : "";

        let contents = this.extractPlaylistContents(data);
        for (let pos = 0; pos < contents.length; pos++) {
            const item = this.parsePlaylistItem(contents[pos], pos + 1);
            if (item) {
                tracks.push(this.itemToTrack(item));
                trackIds.push(item.id);
            }
        }

        let continuation = this.extractContinuationToken(contents);
        while (continuation) {
            const nextData = await this.innertubeRequest<any>("browse", { continuation });
            const nextContents = this.extractContinuationContents(nextData);
            if (!nextContents?.length) break;
            for (let pos = 0; pos < nextContents.length; pos++) {
                const item = this.parsePlaylistItem(nextContents[pos], tracks.length + pos + 1);
                if (item) {
                    tracks.push(this.itemToTrack(item));
                    trackIds.push(item.id);
                }
            }
            continuation = this.extractContinuationToken(nextContents);
        }
        if (tracks.length > 0) {
            const unavailableIds = await this.checkYoutubeTracks(tracks.map(t => t.id));
            const filteredTracks = tracks.filter(t => !unavailableIds.includes(t.id));
            const filteredTrackIds = trackIds.filter(id => !unavailableIds.includes(id));
            if (filteredTracks.length > 0) {
                writeTracks(filteredTracks);
            }
            const playlist: Playlist = {
                thumbnail: thumbnail,
                name: plTitle,
                ids: filteredTrackIds,
                id: id,
                source: "youtube",
                duration: 0,
                tracks: filteredTracks,
            }
            writePlaylist(playlist);
            return playlist;
        }
        const playlist: Playlist = {
            thumbnail: thumbnail,
            name: plTitle,
            ids: [],
            id: id,
            source: "youtube",
            duration: 0,
            tracks: [],
        }
        writePlaylist(playlist);
        return playlist;
    }

    async fetch_playlist(id: string, isHomeData: boolean = false): Promise<Playlist> {
        const key = `playlist:${id}`;
        if (this.inflight.has(key)) return this.inflight.get(key)!;

        const promise = (async () => {
            const browseId = id.startsWith("VL") ? id : `VL${id}`;

            const data = await this.innertubeRequest<any>("browse", { browseId });
            const liveCount = this.extractPlaylistTotalCount(data);

            const cached = getPlaylist(id);
            if (cached && cached.ids?.length && liveCount !== null && liveCount === cached.ids.length) {
                const contents = this.extractPlaylistContents(data);
                const freshIds: string[] = [];
                for (let pos = 0; pos < contents.length; pos++) {
                    const item = this.parsePlaylistItem(contents[pos], pos + 1);
                    if (item) freshIds.push(item.id);
                }
                const firstPageMatch = freshIds.length > 0 &&
                    freshIds.length <= cached.ids.length &&
                    freshIds.every((id, i) => id === cached.ids![i]);

                if (firstPageMatch) {
                    const tracks = isHomeData ? [] : await this.fetch_track(cached.ids);
                    return {
                        source: "youtube",
                        name: cached.name,
                        id: cached.id,
                        thumbnail: cached.thumbnail,
                        duration: tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0),
                        tracks,
                    } as Playlist
                }
            }

            return await this.fetch_playlist_data(id);
        })()
            .catch((e) => { this.log(`Fetch playlist id=${id}, ${e}`); throw e; })
            .finally(() => this.inflight.delete(key));

        this.inflight.set(key, promise);
        return promise;
    }

    async checkYoutubeTracks(ids?: string[]): Promise<string[]> {
        const key = ids?.length ? `checkAvailable:${ids.slice().sort().join(',')}` : "checkAvailable";
        if (this.inflight.has(key)) return this.inflight.get(key)!;

        const promise = (async () => {
            let videoIds: string[];
            if (ids && ids.length > 0) {
                videoIds = Array.from(new Set([...ids]));
            } else {
                videoIds = getAllTracks().map((item: Track) => item.id);
            }
            if (videoIds.length === 0) return [];

            const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
            const now = Date.now();
            const needsCheck: string[] = [];

            const existingStmt = db.prepare(`SELECT id, lastCheckedAt FROM tracks WHERE id IN (SELECT value FROM json_each($ids))`);
            const existing = existingStmt.all({ $ids: JSON.stringify(videoIds) }) as { id: string; lastCheckedAt: number | null }[];
            const existingMap = new Map(existing.map(r => [r.id, r.lastCheckedAt ?? 0]));

            for (const id of videoIds) {
                const lastChecked = existingMap.get(id) ?? 0;
                if (now - lastChecked > CACHE_TTL_MS) {
                    needsCheck.push(id);
                }
            }

            if (needsCheck.length === 0) return [];

            const unavailableTracks: string[] = [];
            const isTrackAvailable = async (id: string) => {
                try {
                    const url = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
                    const response = await Bun.fetch(url, { method: "HEAD", signal: AbortSignal.timeout(2000) });
                    if (!response.ok) return false;
                    const contentLength = response.headers.get("content-length");
                    if (contentLength === "1110") {
                        return false;
                    }
                    return true;
                } catch (error) {
                    return true;
                }
            }

            const CONCURRENCY_LIMIT = 50;
            const updateCheckedStmt = db.prepare(`UPDATE tracks SET lastCheckedAt = ? WHERE id = ?`);
            const updateAvailable = db.transaction((results: { id: string; available: boolean }[]) => {
                for (const res of results) {
                    if (res.available) {
                        updateCheckedStmt.run(now, res.id);
                    } else {
                        unavailableTracks.push(res.id);
                    }
                }
            });

            for (let i = 0; i < needsCheck.length; i += CONCURRENCY_LIMIT) {
                const chunk = needsCheck.slice(i, i + CONCURRENCY_LIMIT);

                const chunkResults = await Promise.all(
                    chunk.map(async (id) => ({
                        id,
                        available: await isTrackAvailable(id)
                    }))
                );

                updateAvailable(chunkResults);
            }

            if (!ids) {
                deleteTracks(unavailableTracks);
            }
            return unavailableTracks;
        })()
            .catch((error) => { this.log(error.message); return []; })
            .finally(() => this.inflight.delete(key));

        this.inflight.set(key, promise);
        return promise;
    }

    async search(query: string, type: "video" | "playlist" | "artist" | "") {
        try {
            const innerType = type === "artist" ? "channel" : type;
            const result = await this.fetchInnerSearch(query, innerType || null);

            const tracks: Track[] = [];
            const playlist_ids: string[] = [];
            const artist_ids: string[] = [];

            for (const item of result.items) {
                const thumbUrl = item.thumbnails?.[0]?.url ? this.ensureHttps(item.thumbnails[0].url) : "";
                if (item.type === "video") {
                    tracks.push({
                        source: "youtube",
                        thumbnail: thumbUrl,
                        artist: [{ name: item.artist ?? "", id: "" }],
                        name: item.title ?? "",
                        id: item.id,
                        duration: (item.duration ?? 0) * 1000,
                        releasedDate: "",
                    } as Track);
                } else if (item.type === "playlist") {
                    playlist_ids.push(item.id);
                } else if (item.type === "channel") {
                    artist_ids.push(item.id);
                }
            }

            let itemsResult = [] as unknown as Track[];
            const trackIds = tracks.map(t => t.id);
            if (trackIds.length > 0) {
                itemsResult = await this.fetch_track(trackIds);
                itemsResult = itemsResult.slice(0, 100);
            }

            return {
                type: "youtube:search",
                tracks: itemsResult,
                playlists: playlist_ids,
                artists: artist_ids,
            }
        }
        catch (e) {
            this.log(e)
            throw new Error(e);
        }
    }

    async fetch_artist(id: string, isHomeData: boolean = false): Promise<Artist> {
        const key = `artist:${id}`;
        if (this.inflight.has(key)) return this.inflight.get(key)!;

        const promise = (async () => {
            const data = await this.innertubeRequest<any>("browse", { browseId: id });

            let artName = "";
            let artThumbnails: Thumbnail[] = [];
            const c4 = data?.header;
            if (c4?.title) {
                artName = c4.title;
                artThumbnails = c4?.avatar?.thumbnails ?? [];
            } else {
                const ph = data?.header?.pageHeaderRenderer;
                const vm = ph?.content?.pageHeaderViewModel;
                artName = vm?.title?.dynamicTextViewModel?.text?.content ?? ph?.pageTitle ?? "";
                const sources = vm?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
                artThumbnails = sources ?? [];
            }

            const uploadsPlaylistId = "UU" + id.slice(2);
            let artist_tracks: Track[] = [];
            if (isHomeData === false) {
                try {
                    const artist_playlist = await this.fetch_playlist_data(uploadsPlaylistId);
                    artist_tracks = artist_playlist.tracks ?? [];
                } catch {
                    artist_tracks = await this.fetch_recent_tracks(id, 10);
                }
            }

            const artThumbnail = artThumbnails?.[0]?.url ? this.ensureHttps(artThumbnails[0].url) : "";

            const this_artist: Artist = {
                source: "youtube",
                id: id,
                name: artName,
                thumbnail: artThumbnail,
                playlistId: uploadsPlaylistId,
                tracks: []
            }
            writeArtist(this_artist)

            return {
                source: "youtube",
                name: artName,
                id: id,
                tracks: artist_tracks,
                thumbnail: artThumbnail,
                playlistId: uploadsPlaylistId,
            } as Artist;
        })()
            .catch((e) => { this.log(e); throw e; })
            .finally(() => this.inflight.delete(key));

        this.inflight.set(key, promise);
        return promise;
    }

    private async fetch_recent_tracks(channelId: string, count: number): Promise<Track[]> {
        try {
            const uploadsPlaylistId = "UU" + channelId.slice(2);
            const browseId = `VL${uploadsPlaylistId}`;
            const data = await this.innertubeRequest<any>("browse", { browseId });
            const contents = this.extractPlaylistContents(data);
            const videoIds: string[] = [];
            for (let pos = 0; pos < contents.length && videoIds.length < count; pos++) {
                const item = this.parsePlaylistItem(contents[pos], pos + 1);
                if (item) videoIds.push(item.id);
            }
            if (videoIds.length === 0) return [];
            return await this.fetch_track(videoIds);
        } catch (e) {
            this.log(e);
            return [];
        }
    }

    async get_new_tracks(ids: string[]) {
        try {
            const new_tracks: Track[] = []
            const results = await Promise.all(ids.map(id => this.fetch_recent_tracks(id, 10)));
            results.forEach(tracks => new_tracks.push(...tracks));
            return new_tracks.sort((a: Track, b: Track) => {
                return new Date(a.releasedDate).getTime() - new Date(b.releasedDate).getTime();
            });
        } catch (e) {
            this.log(e);
            return []
        }
    }
}
