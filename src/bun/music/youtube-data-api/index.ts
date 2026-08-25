import type { Track, Playlist, Artist, SearchResult } from "../../../shared/types.ts";
import { MusicSource, MusicType } from "../../../shared/types.ts";
import { getTracks, writeTracks, deleteTracks, deleteStaleTrackArtists, getPlaylist, writePlaylist, getArtistById, writeArtist, writeLogs, getSearchCache, setSearchCache, getUserData, writeUserData } from "../../db/index.ts";
import { Resource, type ResourceState } from "../../cache/resource.ts";
import type { GoogleAuth } from "../../auth/google.ts";
import iso8601DurationToMilliseconds from "../../../shared/time.ts";
import type Youtube from "../youtube/index.ts";
import { extractPlaylistContents, parsePlaylistItem, itemToTrack } from "../youtube/InnerTube/parser.ts";

const YT_DATA_API_BASE = "https://www.googleapis.com/youtube/v3";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRetries<T>(fn: () => Promise<T | null>, attempts: number, label: string): Promise<T | null> {
    for (let i = 1; i <= attempts; i++) {
        try {
            const result = await fn();
            if (result !== null && result !== undefined) return result;
        } catch (e) {
            writeLogs([{ type: "error", message: `${label} attempt ${i}/${attempts} threw: ${e instanceof Error ? e.message : String(e)}` }]);
        }
        if (i < attempts) await sleep(500 * i);
    }
    return null;
}

function pickThumbnail(thumbnails: any, kind: "video" | "wide" = "video"): string {
    if (!thumbnails) return "";
    if (kind === "video") return thumbnails.medium?.url ?? thumbnails.default?.url ?? "";
    return thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? "";
}

const BROKEN_PIN_TTL_MS = 24 * 3600_000;

interface BrokenPin {
    at: number;
    name: string;
}

export function isPinBroken(pin: string, now: number = Date.now()): boolean {
    const broken = getUserData("brokenPins") ?? {};
    const entry = broken[pin] as BrokenPin | undefined;
    return !!entry && typeof entry.at === "number" && now - entry.at < BROKEN_PIN_TTL_MS;
}

export function markPinBroken(pin: string, name: string) {
    const broken = getUserData("brokenPins") ?? {};
    broken[pin] = { at: Date.now(), name };
    writeUserData("brokenPins", broken);
}

export class YoutubeDataAPI {
    private apiKeys: string[] = [];
    private keyIndex = -1;
    private googleAuth: GoogleAuth | null = null;
    private inflight = new Map<string, Promise<any>>();
    private searchInflight = new Map<string, Promise<SearchResult>>();
    private youtube: Youtube | null = null;
    private resources = new Map<string, Resource<any>>();
    emitDataChanged?: (key: string) => void;

    constructor(googleAuth?: GoogleAuth) {
        this.googleAuth = googleAuth ?? null;
    }

    invalidateUserResources(clearPersisted: boolean = false) {
        for (const resource of this.resources.values()) {
            resource.invalidate(clearPersisted);
        }
    }

    setYoutube(youtube: Youtube) {
        this.youtube = youtube;
    }

    updateApiKeys(keys: string[]) {
        this.apiKeys = keys.filter(k => k.trim().length > 0);
        this.keyIndex = -1;
    }

    private getApiKey(): string | null {
        if (this.apiKeys.length === 0) return null;
        this.keyIndex = (this.keyIndex + 1) % this.apiKeys.length;
        return this.apiKeys[this.keyIndex];
    }

    private get hasApiKeys(): boolean {
        return this.apiKeys.length > 0;
    }

    private async fetch<T>(endpoint: string, params: Record<string, string>, useAuth: boolean = false, attempts: number = 2, ifNoneMatch?: string): Promise<{ data: T | null; error?: string; notModified?: boolean; etag?: string }> {
        let lastError: string | undefined;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            const result = await this.fetchOnce<T>(endpoint, params, useAuth, ifNoneMatch);
            if (result.data !== null) return result;
            if (result.notModified) return result;
            lastError = result.error;
            if (attempt < attempts) await sleep(500 * attempt);
        }
        return { data: null, error: lastError };
    }

    private async fetchOnce<T>(endpoint: string, params: Record<string, string>, useAuth: boolean = false, ifNoneMatch?: string): Promise<{ data: T | null; error?: string; notModified?: boolean; etag?: string }> {
        const url = new URL(`${YT_DATA_API_BASE}/${endpoint}`);
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

        const headers: Record<string, string> = { accept: "application/json" };
        let keyHint = "";

        if (ifNoneMatch) {
            headers["if-none-match"] = ifNoneMatch;
        }

        if (useAuth) {
            if (!this.googleAuth?.hasValidToken) {
                const refreshed = this.googleAuth ? await this.googleAuth.tryRefresh() : false;
                if (!refreshed) {
                    writeLogs([{ type: "error", message: `DataAPI ${endpoint}: no valid OAuth token` }]);
                    return { data: null, error: "No valid OAuth token" };
                }
            }
            headers["authorization"] = `Bearer ${this.googleAuth!.getAccessToken()}`;
        } else {
            const key = this.getApiKey();
            if (!key) {
                writeLogs([{ type: "error", message: `DataAPI ${endpoint}: no API key configured` }]);
                return { data: null, error: "No API key configured" };
            }
            keyHint = key.substring(0, 8);
            url.searchParams.set("key", key);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
            writeLogs([{ type: "error", message: `DataAPI ${endpoint} timeout (15s) ${keyHint ? `key=${keyHint}...` : "(OAuth)"}` }]);
        }, 15000);

        try {
            const res = await fetch(url.toString(), { headers, signal: controller.signal });

            if (res.status === 304) {
                writeLogs([{ type: "info", message: `DataAPI ${endpoint} 304 Not Modified (etag revalidation hit)` }]);
                return { data: null, notModified: true };
            }

            const json = await res.json();
            const etag = json?.etag ?? res.headers.get("etag") ?? undefined;

            if (!res.ok) {
                const err = json?.error?.message ?? `${res.status} ${res.statusText}`;
                writeLogs([{ type: "error", message: `DataAPI ${endpoint} ${res.status} ${keyHint ? `key=${keyHint}...` : "(OAuth)"}: ${err}` }]);
                if (res.status === 401 && useAuth) {
                    writeLogs([{ type: "info", message: `DataAPI ${endpoint} 401, attempting token refresh...` }]);
                    const refreshed = this.googleAuth ? await this.googleAuth.tryRefresh() : false;
                    if (refreshed) {
                        writeLogs([{ type: "info", message: `DataAPI ${endpoint} token refreshed, retrying...` }]);
                        headers["authorization"] = `Bearer ${this.googleAuth!.getAccessToken()}`;
                        const retryRes = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
                        const retryJson = await retryRes.json();
                        if (retryRes.ok) return { data: retryJson as T, etag: retryJson?.etag ?? retryRes.headers.get("etag") ?? undefined };
                    }
                }
                return { data: null, error: err };
            }

            return { data: json as T, etag };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            writeLogs([{ type: "error", message: `DataAPI ${endpoint} fetch error ${keyHint ? `key=${keyHint}...` : "(OAuth)"}: ${msg}` }]);
            return { data: null, error: msg };
        } finally {
            clearTimeout(timeout);
        }
    }

    // ── Fetch tracks ──

    async fetchTrack(ids: string[]): Promise<Track[]> {
        ids = [...new Set(ids.filter(Boolean))];
        if (ids.length === 0) return [];

        const cached = getTracks(ids) ?? [];
        const cachedMap = new Map(cached.map(t => [t.id, t]));
        const uncached = ids.filter(id => !cachedMap.has(id) || !cachedMap.get(id)!.releasedDate || cachedMap.get(id)!.duration < 15_000);

        if (uncached.length === 0) {
            return ids.map(id => cachedMap.get(id)!).filter(Boolean);
        }

        // InnerTube-only mode when no API keys configured
        if (!this.hasApiKeys) {
            const inner = await withRetries(
                () => this.fetchTracksViaInnerTube(uncached),
                3,
                `InnerTube video metadata`
            );
            if (inner && inner.length > 0) {
                const innerMap = new Map(inner.map(t => [t.id, t]));
                for (const id of uncached) {
                    const t = innerMap.get(id);
                    if (t) cachedMap.set(id, t);
                }
            }
            const fetched = [...cachedMap.values()];
            if (fetched.length > 0) writeTracks(fetched);
            return ids.map(id => cachedMap.get(id)).filter(Boolean) as Track[];
        }

        // Group by stored etag so revalidation requests match the previous batch
        // exactly — a 304 is only served when the id set is identical.
        const groups = new Map<string | null, string[]>();
        for (const id of uncached) {
            const etag = cachedMap.get(id)?.etag ?? null;
            const list = groups.get(etag) ?? [];
            list.push(id);
            groups.set(etag, list);
        }

        const BATCH_SIZE = 50;
        const fetched: Track[] = [];

        for (const [etag, group] of groups) {
            for (let i = 0; i < group.length; i += BATCH_SIZE) {
                const batch = group.slice(i, i + BATCH_SIZE);
                const { data, error, notModified, etag: respEtag } = await this.fetch<{ items: any[] }>("videos", {
                    part: "snippet,contentDetails",
                    id: batch.join(","),
                }, false, 2, etag ?? undefined);

                if (notModified) {
                    writeLogs([{ type: "info", message: `DataAPI fetchTrack: batch of ${batch.length} unchanged (304), keeping cached rows` }]);
                    continue;
                }

                if (error || !data?.items) {
                    if (error) writeLogs([{ type: "error", message: `DataAPI fetchTrack: ${error}` }]);
                }

                const returnedIds = new Set((data?.items ?? []).map((v: any) => v.id));
                for (const v of data?.items ?? []) {
                    fetched.push({
                        source: MusicSource.Youtube,
                        id: v.id,
                        name: v.snippet?.title ?? "",
                        artist: [{ name: v.snippet?.channelTitle ?? "Unknown", id: v.snippet?.channelId ?? "" }],
                        thumbnail: pickThumbnail(v.snippet?.thumbnails, "video") ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
                        duration: v.contentDetails?.duration ? iso8601DurationToMilliseconds(v.contentDetails.duration) : 0,
                        releasedDate: v.snippet?.publishedAt?.split("T")[0] ?? "",
                        etag: respEtag,
                    });
                }

                // InnerTube fallback for ids the API key path failed to resolve (max 3 attempts).
                const remaining = batch.filter(id => !returnedIds.has(id));
                if (remaining.length > 0) {
                    const inner = await withRetries(
                        () => this.fetchTracksViaInnerTube(remaining),
                        3,
                        `InnerTube video metadata fallback`
                    );
                    if (inner && inner.length > 0) {
                        const innerMap = new Map(inner.map(t => [t.id, t]));
                        for (const id of remaining) {
                            const t = innerMap.get(id);
                            if (t) fetched.push(t);
                        }
                    }
                }

                const missing = batch.filter((id: string) => !returnedIds.has(id) && !fetched.some(f => f.id === id));
                if (missing.length > 0) {
                    deleteTracks(missing);
                    for (const id of missing) cachedMap.delete(id);
                }
            }
        }

        if (fetched.length > 0) writeTracks(fetched);

        const result = ids.map(id => fetched.find(t => t.id === id) ?? cachedMap.get(id)).filter(Boolean) as Track[];
        return result;
    }

    async refetchTrack(id: string): Promise<Track | null> {
        const tracks = await this.fetchTrack([id]);
        return tracks[0] ?? null;
    }

    private async fetchTracksViaInnerTube(ids: string[]): Promise<Track[]> {
        if (!this.youtube || ids.length === 0) return [];
        const tracks: Track[] = [];
        for (const id of ids) {
            const data = await this.youtube.getVideoDetails(id);
            const vd = data?.videoDetails;
            if (!vd?.videoId) continue;
            tracks.push({
                source: MusicSource.Youtube,
                id: vd.videoId,
                name: vd.title ?? "",
                artist: [{ name: vd.author ?? "Unknown", id: "" }],
                thumbnail: vd.thumbnail?.thumbnails?.at?.(-1)?.url ?? `https://i.ytimg.com/vi/${vd.videoId}/mqdefault.jpg`,
                duration: (parseInt(vd.lengthSeconds ?? "0", 10) || 0) * 1000,
                releasedDate: "",
            });
        }
        return tracks;
    }

    // ── Search ──
    // Search uses InnerTube only (no API key) to save quota. Max 3 attempts.

    async search(query: string, type: MusicType): Promise<SearchResult> {
        const cacheKey = `search:v2:${query}:${type}`;

        const cachedResult = getSearchCache(cacheKey);
        if (cachedResult) {
            writeLogs([{ type: "info", message: `DataAPI search: cache hit for "${query}" (${type})` }]);
            return cachedResult;
        }

        if (this.searchInflight.has(cacheKey)) {
            return this.searchInflight.get(cacheKey)!;
        }

        const promise = (async () => {
            if (!this.youtube) {
                writeLogs([{ type: "error", message: "DataAPI search: InnerTube resolver unavailable" }]);
                return { tracks: [], playlists: [], artists: [] };
            }

            const result = await withRetries(
                () => this.youtube!.searchAll(query, type),
                3,
                "InnerTube search"
            );

            if (!result) {
                writeLogs([{ type: "error", message: `DataAPI search: all 3 InnerTube attempts failed for "${query}"` }]);
                return { tracks: [], playlists: [], artists: [] };
            }

            // Persist newly found items so subsequent metadata calls can hit cache first.
            if (result.tracks.length > 0) writeTracks(result.tracks);
            setSearchCache(cacheKey, result);
            return result;
        })().finally(() => {
            this.searchInflight.delete(cacheKey);
        });

        this.searchInflight.set(cacheKey, promise);
        return promise;
    }

    // ── Fetch playlist ──

    async fetchPlaylist(id: string, isHomeData: boolean = false, forceRefresh: boolean = false): Promise<Playlist> {
        const key = `playlist:${id}`;
        if (this.inflight.has(key)) return this.inflight.get(key)!;

        const promise = (async () => {
            const cached = getPlaylist(id);
            const TTL = 3600_000;

            if (!forceRefresh && !isHomeData && cached && cached.ids?.length && cached.lastFetched && (Date.now() - cached.lastFetched) < TTL) {
                const tracks = await this.fetchTrack(cached.ids);
                return {
                    source: MusicSource.Youtube,
                    name: cached.name,
                    id: cached.id,
                    thumbnail: cached.thumbnail,
                    duration: tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0),
                    tracks,
                } as Playlist;
            }

            if (isHomeData) {
                if (cached) {
                    return {
                        source: MusicSource.Youtube,
                        name: cached.name,
                        id: cached.id,
                        thumbnail: cached.thumbnail,
                        duration: 0,
                        tracks: [],
                    } as Playlist;
                }

                // InnerTube-only mode when no API keys configured
                if (!this.hasApiKeys) {
                    const inner = await this.fetchPlaylistViaInnerTube(id);
                    if (inner) {
                        writePlaylist(inner);
                        return inner;
                    }
                    return { source: MusicSource.Youtube, name: "", id, thumbnail: "", duration: 0, tracks: [] };
                }

                const { data, error } = await this.fetch<any>("playlists", { part: "snippet,contentDetails", id });
                if (error || !data?.items?.[0]) return { source: MusicSource.Youtube, name: "", id, thumbnail: "", duration: 0, tracks: [] };
                const p = data.items[0];
                const pl: Playlist = {
                    source: MusicSource.Youtube,
                    name: p.snippet?.title ?? "",
                    id,
                    thumbnail: pickThumbnail(p.snippet?.thumbnails),
                    duration: 0,
                    itemCount: p.contentDetails?.itemCount,
                    tracks: [],
                };
                writePlaylist(pl);
                return pl;
            }

            return await this.fetchPlaylistData(id, cached);
        })()
            .catch((e) => { writeLogs([{ type: "error", message: `DataAPI fetchPlaylist: ${e}` }]); throw e; })
            .finally(() => this.inflight.delete(key));

        this.inflight.set(key, promise);
        return promise;
    }

    private async fetchPlaylistData(id: string, existing: Playlist | null = null): Promise<Playlist> {
        // InnerTube-only mode when no API keys configured
        if (!this.hasApiKeys) {
            const inner = await withRetries(
                () => this.fetchPlaylistViaInnerTube(id),
                3,
                `InnerTube playlist`
            );
            if (inner?.tracks?.length) {
                writeTracks(inner.tracks);
                writePlaylist(inner);
                return inner;
            }
            return { source: MusicSource.Youtube, name: existing?.name ?? "", id, thumbnail: existing?.thumbnail ?? "", duration: 0, ids: [], tracks: [] };
        }

        const allTracks: Track[] = [];
        let pageToken: string | undefined;
        let plName = existing?.name ?? "";
        let plThumbnail = existing?.thumbnail ?? "";
        let playlistEtag: string | undefined;
        let pageIndex = 0;

        while (true) {
            const params: Record<string, string> = {
                part: "snippet",
                playlistId: id,
                maxResults: "50",
            };
            if (pageToken) params["pageToken"] = pageToken;

            // Page 1 revalidates with the stored etag — a 304 means the whole
            // playlist is unchanged, so serve the cached rows without fetching
            // the remaining pages or any track metadata.
            const { data, error, notModified, etag: pageEtag } = await this.fetch<{ items: any[]; nextPageToken?: string }>(
                "playlistItems",
                params,
                false,
                2,
                pageIndex === 0 && existing?.ids?.length ? existing.etag : undefined
            );

            if (notModified) {
                writeLogs([{ type: "info", message: `DataAPI fetchPlaylistData: ${id} unchanged (304), serving cached playlist` }]);
                const tracks = existing?.ids?.length ? await this.fetchTrack(existing.ids) : [];
                return {
                    source: MusicSource.Youtube,
                    name: existing?.name ?? "",
                    id,
                    thumbnail: existing?.thumbnail ?? "",
                    duration: tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0),
                    ids: existing?.ids ?? [],
                    tracks,
                    etag: existing?.etag,
                } as Playlist;
            }

            if (error || !data?.items) {
                if (error) writeLogs([{ type: "error", message: `DataAPI playlistItems: ${error}` }]);
                break;
            }
            if (pageIndex === 0) playlistEtag = pageEtag;
            pageIndex++;

            for (const item of data.items) {
                const vid = item.snippet?.resourceId?.videoId;
                if (vid) {
                    allTracks.push({
                        source: MusicSource.Youtube,
                        id: vid,
                        name: item.snippet?.title ?? "",
                        artist: [{ name: item.snippet?.videoOwnerChannelTitle ?? "", id: item.snippet?.videoOwnerChannelId ?? "" }],
                        thumbnail: pickThumbnail(item.snippet?.thumbnails, "video") || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
                        duration: 0,
                        releasedDate: item.snippet?.publishedAt?.split("T")[0] ?? "",
                    });
                }
            }

            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }

        if (allTracks.length === 0 && existing?.ids?.length) {
            writeLogs([{ type: "error", message: `DataAPI fetchPlaylistData: ${id} returned no items, falling back to cached playlist` }]);
            const tracks = await this.fetchTrack(existing.ids);
            return {
                source: MusicSource.Youtube,
                name: plName || existing.name,
                id,
                thumbnail: plThumbnail || existing.thumbnail,
                duration: tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0),
                ids: existing.ids,
                tracks,
                etag: existing.etag,
            } as Playlist;
        }

        const { data: plData, error: plError } = await this.fetch<any>("playlists", { part: "snippet,contentDetails", id });
        if (!plError && plData?.items?.[0]) {
            const p = plData.items[0];
            plName = p.snippet?.title ?? "";
            plThumbnail = pickThumbnail(p.snippet?.thumbnails);
        }

        const trackIds = allTracks.map(t => t.id);
        const fetched = trackIds.length > 0 ? await this.fetchTrack(trackIds) : [];

        // InnerTube fallback: API key path returned nothing — pull the playlist via browse (max 3 attempts).
        if (fetched.length === 0 && this.youtube) {
            const inner = await withRetries(
                () => this.fetchPlaylistViaInnerTube(id),
                3,
                `InnerTube playlist fallback`
            );
            if (inner?.tracks?.length) {
                fetched.push(...inner.tracks);
                plName = plName || inner.name;
                plThumbnail = plThumbnail || inner.thumbnail;
            }
        }

        if (fetched.length > 0) writeTracks(fetched);

        // Clean stale track_artists links for tracks no longer in this playlist
        const artistIds = [...new Set(allTracks.map(t => t.artist[0]?.id).filter(Boolean))] as string[];
        for (const artistId of artistIds) {
            deleteStaleTrackArtists(artistId, trackIds);
        }

        const ordered = trackIds.map(tid => fetched.find(t => t.id === tid)).filter(Boolean) as Track[];
        const playlist: Playlist = {
            source: MusicSource.Youtube,
            name: plName,
            id,
            thumbnail: plThumbnail,
            duration: ordered.reduce((sum, t) => sum + (t.duration ?? 0), 0),
            ids: trackIds,
            tracks: ordered,
            etag: playlistEtag,
        };

        writePlaylist(playlist);
        return playlist;
    }

    private async fetchPlaylistViaInnerTube(id: string): Promise<Playlist | null> {
        if (!this.youtube) return null;
        const data = await this.youtube.browsePlaylist(id);
        if (!data) return null;

        const contents = extractPlaylistContents(data);
        const tracks: Track[] = [];
        let name = "";
        let thumbnail = "";

        contents.forEach((item, idx) => {
            const parsed = parsePlaylistItem(item, idx);
            if (parsed) tracks.push(itemToTrack(parsed));
        });

        // Try to read playlist title/thumbnail from header for nicer cards.
        const header = data?.header?.playlistHeaderRenderer;
        if (header?.title?.runs) name = header.title.runs.map((r: any) => r.text ?? "").join("");
        else if (header?.title?.simpleText) name = header.title.simpleText;
        thumbnail = header?.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.at?.(-1)?.url
            ?? header?.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url
            ?? tracks[0]?.thumbnail ?? "";

        return tracks.length > 0
            ? {
                source: MusicSource.Youtube,
                name,
                id,
                thumbnail,
                duration: tracks.reduce((s, t) => s + (t.duration ?? 0), 0),
                ids: tracks.map(t => t.id),
                tracks,
            }
            : null;
    }

    // ── Fetch artist ──

    async fetchArtist(id: string, isHomeData: boolean = false, forceRefresh: boolean = false): Promise<Artist> {
        const key = `artist:${id}`;
        if (this.inflight.has(key)) return this.inflight.get(key)!;

        const promise = (async () => {
            const cached = getArtistById(id, true);
            const ttl = cached?.cacheTtl ?? 3600_000;
            if (!isHomeData && !forceRefresh && cached && cached.tracks.length > 0 && cached.lastFetched && (Date.now() - cached.lastFetched) < ttl) {
                return cached;
            }

            let artName = "";
            let artThumbnail = "";
            const uploadsPlaylistId = "UU" + id.slice(2);

            // InnerTube-only mode when no API keys configured
            if (!this.hasApiKeys) {
                const channelInfo = this.youtube ? await withRetries(
                    () => this.youtube!.getChannelInfo(id),
                    3,
                    `InnerTube channel info`
                ) : null;
                artName = channelInfo?.name ?? cached?.name ?? "";
                artThumbnail = channelInfo?.thumbnail ?? cached?.thumbnail ?? "";

                let artistTracks: Track[] = [];
                if (!isHomeData) {
                    const inner = await withRetries(
                        () => this.fetchPlaylistViaInnerTube(uploadsPlaylistId),
                        3,
                        `InnerTube artist uploads`
                    );
                    artistTracks = inner?.tracks ?? [];
                }

                const thisArtist: Artist = {
                    source: MusicSource.Youtube,
                    id,
                    name: artName,
                    thumbnail: artThumbnail,
                    playlistId: uploadsPlaylistId,
                    tracks: isHomeData ? [] : artistTracks,
                };
                writeArtist(thisArtist);
                return thisArtist;
            }

            const { data, error, notModified, etag } = await this.fetch<any>("channels", { part: "snippet", id }, false, 2, cached && cached.tracks.length > 0 ? cached.etag : undefined);
            if (notModified && cached) {
                writeLogs([{ type: "info", message: `DataAPI fetchArtist: ${id} unchanged (304), serving cached artist` }]);
                return cached;
            }
            if (error || !data?.items?.[0]) {
                // Channels API returned an empty items list (channel deleted/renamed).
                // Remember the pin as broken so the home feed skips it without
                // retrying for 24h — real API errors (bad key/quota) and non-channel
                // ids (e.g. a video id used as an artist reference) are NOT recorded.
                if (!error && id.startsWith("UC")) {
                    markPinBroken(`${MusicSource.Youtube}:${MusicType.Artist}:${id}`, cached?.name ?? "");
                    writeLogs([{ type: "info", message: `DataAPI fetchArtist: ${id} channel not found, marked broken` }]);
                }
                throw new Error(error ?? "Channel not found");
            }

            const ch = data.items[0];
            artName = ch.snippet?.title ?? "";
            artThumbnail = pickThumbnail(ch.snippet?.thumbnails);

            let artistTracks: Track[] = [];
            if (!isHomeData) {
                try {
                    const pl = await this.fetchPlaylistData(uploadsPlaylistId);
                    artistTracks = pl.tracks ?? [];
                } catch {
                    artistTracks = [];
                }
                // InnerTube fallback: API key path failed to resolve the uploads playlist.
                if (artistTracks.length === 0 && this.youtube) {
                    const inner = await withRetries(
                        () => this.fetchPlaylistViaInnerTube(uploadsPlaylistId),
                        3,
                        `InnerTube artist uploads fallback`
                    );
                    artistTracks = inner?.tracks ?? [];
                }
            }

            const thisArtist: Artist = {
                source: MusicSource.Youtube,
                id,
                name: artName,
                thumbnail: artThumbnail,
                playlistId: uploadsPlaylistId,
                tracks: isHomeData ? [] : artistTracks,
                etag,
            };
            writeArtist(thisArtist);

            return {
                source: MusicSource.Youtube,
                name: artName,
                id,
                tracks: artistTracks,
                thumbnail: artThumbnail,
                playlistId: uploadsPlaylistId,
                etag,
            } as Artist;
        })()
            .catch((e) => { writeLogs([{ type: "error", message: `DataAPI fetchArtist: ${e}` }]); throw e; })
            .finally(() => this.inflight.delete(key));

        this.inflight.set(key, promise);
        return promise;
    }

    // ── Get new / recent tracks ──

    async getNewTracks(channelIds: string[]): Promise<Track[]> {
        const unique = [...new Set(channelIds.filter(Boolean))].filter(id => !isPinBroken(`${MusicSource.Youtube}:${MusicType.Artist}:${id}`));
        if (unique.length === 0) return [];

        const results = await Promise.all(unique.map(id => this.fetchRecentTracks(id, 10)));
        const all = results.flat();
        all.sort((a, b) => new Date(a.releasedDate).getTime() - new Date(b.releasedDate).getTime());
        return all;
    }

    private async fetchRecentTracks(channelId: string, count: number): Promise<Track[]> {
        const uploadsId = "UU" + channelId.slice(2);

        // InnerTube-only mode when no API keys configured
        if (!this.hasApiKeys) {
            const inner = await withRetries(
                () => this.fetchPlaylistViaInnerTube(uploadsId),
                3,
                `InnerTube recent tracks`
            );
            if (!inner?.tracks?.length) return [];
            return inner.tracks.slice(0, count);
        }

        const allIds: string[] = [];
        let pageToken: string | undefined;

        while (allIds.length < count) {
            const params: Record<string, string> = {
                part: "snippet",
                playlistId: uploadsId,
                maxResults: "50",
            };
            if (pageToken) params["pageToken"] = pageToken;

            const { data, error } = await this.fetch<{ items: any[]; nextPageToken?: string }>("playlistItems", params);
            if (error || !data?.items) break;

            for (const item of data.items) {
                const vid = item.snippet?.resourceId?.videoId;
                if (vid) allIds.push(vid);
                if (allIds.length >= count) break;
            }

            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }

        if (allIds.length === 0) return [];
        return await this.fetchTrack(allIds);
    }

    // ── OAuth methods (already existing) ──

    async getUserPlaylists(): Promise<Playlist[]> {
        return this.getUserPlaylistsResource().get();
    }

    private getUserPlaylistsResource(): Resource<Playlist[]> {
        let resource = this.resources.get("userPlaylists");
        if (resource) return resource;
        resource = new Resource<Playlist[]>({
            key: "userPlaylists",
            ttl: 30 * 60_000,
            loadPartial: (ifNoneMatch) => this.fetchUserPlaylistsPage(ifNoneMatch),
            loadFull: () => this.loadUserPlaylists(),
            loadPersisted: () => {
                const data = getUserData("youtubePlaylists");
                if (!data) return null;
                if (data.some((pl) => pl.itemCount === undefined)) return null;
                const etag = getUserData("youtubePlaylistsEtag");
                return { data, etag: etag || undefined, at: Date.now(), complete: true };
            },
            persist: (state: ResourceState<Playlist[]>) => {
                writeUserData("youtubePlaylists", state.data);
                if (state.etag) writeUserData("youtubePlaylistsEtag", state.etag);
            },
            clearPersisted: () => {
                writeUserData("youtubePlaylists", []);
                writeUserData("youtubePlaylistsEtag", "");
            },
            emit: () => this.emitDataChanged?.("userPlaylists"),
        });
        this.resources.set("userPlaylists", resource);
        return resource;
    }

    private async fetchUserPlaylistsPage(ifNoneMatch?: string): Promise<{ data: Playlist[]; etag?: string; notModified?: boolean } | null> {
        const { data, error, notModified, etag } = await this.fetch<{ items: any[] }>("playlists", {
            part: "snippet,contentDetails",
            mine: "true",
            maxResults: "50",
        }, true, 2, ifNoneMatch);
        if (notModified) return { data: [], notModified: true };
        if (error || !data?.items) {
            if (error) writeLogs([{ type: "error", message: `DataAPI getUserPlaylists: ${error}` }]);
            return null;
        }
        const playlists = data.items.map((p: any) => ({
            name: p.snippet?.title ?? "",
            id: p.id,
            source: MusicSource.Youtube,
            thumbnail: pickThumbnail(p.snippet?.thumbnails),
            duration: 0,
            ids: [],
            itemCount: p.contentDetails?.itemCount,
        }));
        return { data: playlists, etag };
    }

    private async loadUserPlaylists(): Promise<{ data: Playlist[]; etag?: string } | null> {
        const all: Playlist[] = [];
        let pageToken: string | undefined;
        let collectionEtag: string | undefined;

        while (true) {
            const params: Record<string, string> = {
                part: "snippet,contentDetails",
                mine: "true",
                maxResults: "50",
            };
            if (pageToken) params["pageToken"] = pageToken;

            const { data, error, etag } = await this.fetch<{ items: any[]; nextPageToken?: string }>("playlists", params, true);
            if (error || !data?.items) {
                if (error) writeLogs([{ type: "error", message: `DataAPI getUserPlaylists: ${error}` }]);
                return null;
            }
            if (!collectionEtag) collectionEtag = etag;

            for (const p of data.items) {
                all.push({
                    name: p.snippet?.title ?? "",
                    id: p.id,
                    source: MusicSource.Youtube,
                    thumbnail: pickThumbnail(p.snippet?.thumbnails),
                    duration: 0,
                    ids: [],
                    itemCount: p.contentDetails?.itemCount,
                });
            }

            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }

        all.forEach((pl) => writePlaylist(pl));
        return { data: all, etag: collectionEtag };
    }

    async getUserSubscriptions(): Promise<Artist[]> {
        return this.getUserSubscriptionsResource().get();
    }

    private getUserSubscriptionsResource(): Resource<Artist[]> {
        let resource = this.resources.get("userSubscriptions");
        if (resource) return resource;
        resource = new Resource<Artist[]>({
            key: "userSubscriptions",
            ttl: 30 * 60_000,
            loadPartial: (ifNoneMatch) => this.fetchUserSubscriptionsPage(ifNoneMatch),
            loadFull: () => this.loadUserSubscriptions(),
            loadPersisted: () => {
                const data = getUserData("youtubeSubscriptions");
                if (!data) return null;
                const etag = getUserData("youtubeSubscriptionsEtag");
                return { data, etag: etag || undefined, at: Date.now(), complete: true };
            },
            persist: (state: ResourceState<Artist[]>) => {
                writeUserData("youtubeSubscriptions", state.data);
                if (state.etag) writeUserData("youtubeSubscriptionsEtag", state.etag);
            },
            clearPersisted: () => {
                writeUserData("youtubeSubscriptions", []);
                writeUserData("youtubeSubscriptionsEtag", "");
            },
            emit: () => this.emitDataChanged?.("userSubscriptions"),
        });
        this.resources.set("userSubscriptions", resource);
        return resource;
    }

    private async fetchUserSubscriptionsPage(ifNoneMatch?: string): Promise<{ data: Artist[]; etag?: string; notModified?: boolean } | null> {
        const { data, error, notModified, etag } = await this.fetch<{ items: any[] }>("subscriptions", {
            part: "snippet,contentDetails",
            mine: "true",
            maxResults: "50",
        }, true, 2, ifNoneMatch);
        if (notModified) return { data: [], notModified: true };
        if (error || !data?.items) {
            if (error) writeLogs([{ type: "error", message: `DataAPI getUserSubscriptions: ${error}` }]);
            return null;
        }
        const artists = data.items.map((s: any) => {
            const channelId = s.snippet?.resourceId?.channelId ?? "";
            return {
                name: s.snippet?.title ?? "",
                id: channelId,
                source: MusicSource.Youtube,
                thumbnail: pickThumbnail(s.snippet?.thumbnails),
                tracks: [],
                playlistId: channelId ? "UU" + channelId.slice(2) : "",
            };
        });
        return { data: artists, etag };
    }

    private async loadUserSubscriptions(): Promise<{ data: Artist[]; etag?: string } | null> {
        const all: Artist[] = [];
        let pageToken: string | undefined;
        let collectionEtag: string | undefined;

        while (true) {
            const params: Record<string, string> = {
                part: "snippet,contentDetails",
                mine: "true",
                maxResults: "50",
            };
            if (pageToken) params["pageToken"] = pageToken;

            const { data, error, etag } = await this.fetch<{ items: any[]; nextPageToken?: string }>("subscriptions", params, true);
            if (error || !data?.items) {
                if (error) writeLogs([{ type: "error", message: `DataAPI getUserSubscriptions: ${error}` }]);
                return null;
            }
            if (!collectionEtag) collectionEtag = etag;

            for (const s of data.items) {
                const channelId = s.snippet?.resourceId?.channelId ?? "";
                all.push({
                    name: s.snippet?.title ?? "",
                    id: channelId,
                    source: MusicSource.Youtube,
                    thumbnail: pickThumbnail(s.snippet?.thumbnails),
                    tracks: [],
                    playlistId: channelId ? "UU" + channelId.slice(2) : "",
                });
            }

            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }

        all.forEach((a) => writeArtist(a));
        return { data: all, etag: collectionEtag };
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        const allTracks: Track[] = [];
        let pageToken: string | undefined;

        while (true) {
            const params: Record<string, string> = {
                part: "snippet,contentDetails",
                playlistId,
                maxResults: "50",
            };
            if (pageToken) params["pageToken"] = pageToken;

            const { data, error } = await this.fetch<{ items: any[]; nextPageToken?: string }>("playlistItems", params, true);
            if (error || !data?.items) {
                if (error) writeLogs([{ type: "error", message: `DataAPI getPlaylistTracks: ${error}` }]);
                break;
            }

            for (const item of data.items) {
                const vid = item.snippet?.resourceId?.videoId;
                if (vid) {
                    allTracks.push({
                        source: MusicSource.Youtube,
                        id: vid,
                        name: item.snippet?.title ?? "",
                        artist: [{ name: item.snippet?.videoOwnerChannelTitle ?? "", id: item.snippet?.videoOwnerChannelId ?? "" }],
                        thumbnail: pickThumbnail(item.snippet?.thumbnails, "video") || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
                        duration: 0,
                        releasedDate: item.snippet?.publishedAt?.split("T")[0] ?? "",
                    });
                }
            }

            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }

        const trackIds = allTracks.map(t => t.id);
        return trackIds.length > 0 ? this.fetchTrack(trackIds) : [];
    }
}
