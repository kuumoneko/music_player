import { Playlist, Track, Artist } from "../../shared/types.ts";
import { getArtistById, getPlaylist, getTracks, writeArtist, writeLogs, writePlaylist, writeTracks } from "../db/index.ts";
import deleteTracks from "../db/tracks/delete.ts";
import { getAllTracks } from "../db/tracks/get.ts";

const genericUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const INNERTUBE_BASE = "https://www.youtube.com/youtubei/v1";
const YT_HOME = "https://www.youtube.com";
const MAX_RESULTS = 50;

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

interface InnerArtistVideo {
    id: string;
    title: string;
    artist: string;
    channelId: string | null;
    duration: number;
    thumbnails: Thumbnail[];
    viewCount: number;
    publishedAt: string | null;
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
    private running: any[] = [];
    // private tracks: Record<string, Track> = {};
    // private playlists: Record<string, Playlist> = {};
    // private artists: Record<string, Artist> = {};

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
                } catch { }
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
            return (
                data?.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction?.continuationItems ??
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
            const token =
                item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ??
                item?.continuationEndpoint?.continuationCommand?.token ??
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

    private parseArtistVideo(vr: any): InnerArtistVideo | null {
        if (!vr?.videoId) return null;

        const lengthStr =
            vr.lengthSeconds ??
            vr.lengthText?.simpleText ??
            vr.lengthText?.runs?.[0]?.text ??
            "";

        return {
            id: vr.videoId,
            title: vr.title?.runs?.[0]?.text ?? vr.title?.simpleText ?? "",
            artist: vr.ownerText?.runs?.[0]?.text ??
                vr.shortBylineText?.runs?.[0]?.text ?? "",
            channelId: vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ??
                vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null,
            duration: parseInt(lengthStr) || 0,
            thumbnails: vr.thumbnail?.thumbnails ?? [],
            viewCount: parseInt(
                vr.viewCountText?.simpleText?.replace(/\D/g, "") ??
                vr.shortViewCountText?.simpleText?.replace(/\D/g, "") ?? "0"
            ) || 0,
            publishedAt: vr.publishedTimeText?.simpleText ??
                vr.publishedTimeText?.runs?.[0]?.text ?? null,
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

    private parseGridVideoRenderer(gvr: any): InnerArtistVideo | null {
        if (!gvr?.videoId) return null;

        return {
            id: gvr.videoId,
            title: gvr.title?.simpleText ?? gvr.title?.runs?.[0]?.text ?? "",
            artist: "",
            channelId: null,
            duration: 0,
            thumbnails: gvr.thumbnail?.thumbnails ?? [],
            viewCount: parseInt(
                gvr.viewCountText?.simpleText?.replace(/\D/g, "") ??
                gvr.shortViewCountText?.simpleText?.replace(/\D/g, "") ?? "0"
            ) || 0,
            publishedAt: gvr.publishedTimeText?.simpleText ??
                gvr.publishedTimeText?.runs?.[0]?.text ?? null,
        };
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

    // --- Public methods (shared types + DB) ---

    log(message: any) {
        writeLogs([{ type: "error", message: typeof message === "string" ? message : message?.message ?? String(message) }])
    }

    // get_data(doc: "tracks" | "playlists" | "artists", ids: string[]) {
    //     try {
    //         const res = ids.map((id: string) => {
    //             const map = doc === "tracks" ? this.tracks : doc === "playlists" ? this.playlists : this.artists;
    //             return map[id] ?? { id, name: undefined };
    //         })
    //         return res;
    //     } catch (error) {
    //         this.log(error);
    //         return [];
    //     }
    // }

    // async write_data(doc: "tracks" | "playlists" | "artists", ids: string[], data: any) {
    //     try {
    //         const map = doc === "tracks" ? this.tracks : doc === "playlists" ? this.playlists : this.artists;
    //         const dataMap = new Map(data.map((item: any) => [item.id, item]));
    //         ids.forEach((id: string) => {
    //             map[id] = dataMap.get(id) ?? { id, name: undefined };
    //         })
    //         return "ok"
    //     } catch (error) {
    //         this.log(error);
    //         return undefined
    //     }
    // }

    async checkYoutubeTracks() {
        let videoIds = getAllTracks().map((item: Track) => item.id);
        if (videoIds.length === 0) return;
        if (this.running.some(item => item.name === "checkAvailable")) return;
        this.running.push({
            name: "checkAvailable"
        });
        videoIds = Array.from(new Set([...videoIds]))
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

        const CONCURRENCY_LIMIT = 10;

        for (let i = 0; i < videoIds.length; i += CONCURRENCY_LIMIT) {
            const chunk = videoIds.slice(i, i + CONCURRENCY_LIMIT);

            const chunkResults = await Promise.all(
                chunk.map(async (id) => ({
                    id,
                    available: await isTrackAvailable(id)
                }))
            );

            chunkResults.forEach(res => {
                if (!res.available) unavailableTracks.push(res.id);
            });

            console.log(`Progress: ${Math.min(i + CONCURRENCY_LIMIT, videoIds.length)}/${videoIds.length}`);
        }
        deleteTracks(unavailableTracks)
        this.running = this.running.filter((item: any) => { return item.name !== "checkAvailable" })
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
            for (const id of tracks_out_database) {
                try {
                    const data = await this.innertubeRequest<any>("player", { videoId: id });
                    if (!data?.videoDetails) continue;
                    const vd = data.videoDetails;
                    const mf = data.microformat?.playerMicroformatRenderer ?? {};
                    console.log(mf.publishDate, vd.lengthSeconds)
                    temp_tracks.push({
                        // etag: "",
                        source: "youtube",
                        thumbnail: `https://i.ytimg.com/vi/${vd.videoId}/default.jpg`,
                        artist: [{ name: vd.author ?? "", id: vd.channelId ?? "" }],
                        name: vd.title ?? "",
                        id: vd.videoId,
                        duration: (parseInt(vd.lengthSeconds) || 0) * 1000,
                        releasedDate: mf.publishDate?.split("T")[0] ?? "",
                    });
                } catch { }
            }
        }
        const res = [...tracks_in_database, ...temp_tracks].map(track => {
            return {
                ...track,
                thumbnail: `https://i.ytimg.com/vi/${track.id}/default.jpg`,
            }
        })
        if (res.length > 0) {
            writeTracks(res)
        }
        return res.sort((a: Track, b: Track) => {
            return (
                new Date(b.releasedDate).getTime() -
                new Date(a.releasedDate).getTime()
            );
        });
    }

    fetch_playlist(id: string): Promise<Playlist> {
        return new Promise(async (resolve) => {
            const tracks: string[] = [];
            let this_playlist = getPlaylist(id)
            try {
                let thumbnail: string = "";
                if (this_playlist !== null && this_playlist !== undefined && ((this_playlist?.ids as string[] ?? []).length) > 0) {
                    const tracks = await this.fetch_track(this_playlist?.ids as string[]);
                    resolve({
                        source: "youtube",
                        name: this_playlist.name,
                        id: this_playlist.id,
                        // etag: this_playlist.etag,
                        thumbnail: this_playlist.thumbnail,
                        duration: tracks.reduce((item: number, b: Track) => item + (b.duration as number), 0),
                        tracks: tracks
                    })
                }
                if (this.running.filter((item: any) => { item.name === `playlist:${id}` }).length === 0) {
                    this.running.push({
                        name: `playlist:${id}`
                    })
                } else {
                    return;
                }
                resolve({} as any)

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

                if (plTitle && thumbnail === "") {
                    thumbnail = plThumbnails?.[0]?.url ?? "";
                }

                const contents = this.extractPlaylistContents(data);
                for (let pos = 0; pos < contents.length; pos++) {
                    const item = this.parsePlaylistItem(contents[pos], pos + 1);
                    if (item) tracks.push(item.id);
                }

                let continuation = this.extractContinuationToken(contents);
                while (tracks.length < MAX_RESULTS && continuation) {
                    const nextData = await this.innertubeRequest<any>("browse", { continuation });
                    const nextContents = this.extractContinuationContents(nextData);
                    if (!nextContents?.length) break;
                    for (let pos = 0; pos < nextContents.length; pos++) {
                        const item = this.parsePlaylistItem(nextContents[pos], tracks.length + pos + 1);
                        if (item) tracks.push(item.id);
                    }
                    continuation = this.extractContinuationToken(nextContents);
                }

                this_playlist = {
                    // etag: "",
                    thumbnail: thumbnail,
                    name: this_playlist?.name ?? plTitle,
                    ids: Array.from(new Set([...tracks, ...this_playlist?.ids as [] ?? []])),
                    id: id,
                    source: "youtube",
                    duration: 0
                }

                this.running = this.running.filter((item: { name: string }) => { return item.name !== `playlist:${id}` });
                const Realtracks = await this.fetch_track(this_playlist.ids);
                writePlaylist({
                    ...this_playlist,
                    tracks: Realtracks
                });
            }
            catch (e) {
                this.running = this.running.filter((item: { name: string }) => { return item.name !== `playlist:${id}` })
                this.log(`Fetch playlist id=${id}, ${e}`)
            }
        })
    }

    async fetch_contentRating(ids: string[]): Promise<Record<string, any>> {
        const ratings: Record<string, any> = {};
        for (const id of ids) {
            try {
                const data = await this.innertubeRequest<any>("player", { id });
                const status = data?.playabilityStatus?.status ?? "UNKNOWN";
                const ytRating = status === "OK" ? "ytUnspecified" : "ytAgeRestricted";
                ratings[id] = { ytRating };
            } catch { }
        }
        return ratings;
    }

    async search(query: string, type: "video" | "playlist" | "artist" | "") {
        try {
            const innerType = type === "artist" ? "channel" : type;
            const result = await this.fetchInnerSearch(query, innerType || null);

            const tracks: Track[] = [];
            const playlist_ids: any[] = [];
            const artist_ids: any[] = [];

            for (const item of result.items) {
                if (item.type === "video") {
                    tracks.push({
                        // etag: "",
                        source: "youtube",
                        thumbnail: item.thumbnails?.[0]?.url ?? "",
                        artist: [{ name: item.artist ?? "", id: "" }],
                        name: item.title ?? "",
                        id: item.id,
                        duration: (item.duration ?? 0) * 1000,
                        releasedDate: "",
                    });
                } else if (item.type === "playlist") {
                    playlist_ids.push({
                        type: "youtube:playlist",
                        id: item.id,
                        name: item.title,
                        thumbnail: item.thumbnails?.[0]?.url ?? "",
                    });
                } else if (item.type === "channel") {
                    artist_ids.push({
                        type: "youtube:artist",
                        id: item.id,
                        name: item.title ?? item.name,
                        thumbnail: item.thumbnails?.[0]?.url ?? "",
                    });
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
        catch (e: any) {
            this.log(e)
            throw new Error(e);
        }
    }

    async fetch_artist(id: string): Promise<Artist> {
        if (this.running.filter((item: any) => { item.name === `artist:${id}` }).length === 0) {
            this.running.push({
                name: `artist:${id}`
            })
        } else {
            return null as unknown as Artist;
        }
        let this_artist = getArtistById(id);
        try {
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

            const artVideos: { id: string; title: string; artist: string; channelId: string | null; duration: number; thumbnails: Thumbnail[]; publishedAt: string | null }[] = [];
            const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
            for (const tab of tabs) {
                const tabData = tab?.tabRenderer;
                if (!tabData) continue;
                const tabTitle: string = tabData.title ?? tabData.endpoint?.browseEndpoint?.params ?? "";
                const tc = tabData.content;
                if (!tc) continue;

                const slrContents = tc?.sectionListRenderer?.contents;
                if (slrContents) {
                    for (const section of slrContents) {
                        const isrItems = section?.itemSectionRenderer?.contents;
                        if (!isrItems) continue;
                        for (const item of isrItems) {
                            const shelf = item?.shelfRenderer;
                            const cvpr = item?.channelVideoPlayerRenderer;
                            if (tabTitle === "Videos" || tabTitle === "Home") {
                                if (shelf) {
                                    const hlr = shelf?.content?.horizontalListRenderer?.items;
                                    if (hlr) {
                                        for (const hi of hlr) {
                                            const parsed = this.parseGridVideoRenderer(hi?.gridVideoRenderer);
                                            if (parsed) artVideos.push(parsed);
                                        }
                                    }
                                    const escrItems = shelf?.content?.expandedShelfContentsRenderer?.items;
                                    if (escrItems) {
                                        for (const ei of escrItems) {
                                            const parsed = this.parseArtistVideo(ei?.videoRenderer);
                                            if (parsed) artVideos.push(parsed);
                                        }
                                    }
                                }
                                if (cvpr?.videoId) {
                                    const parsed = this.parseArtistVideo({
                                        videoId: cvpr.videoId, title: cvpr.title, thumbnail: cvpr.thumbnail,
                                    });
                                    if (parsed) artVideos.push(parsed);
                                }
                            }
                        }
                    }
                }

                const rgrContents = tc?.richGridRenderer?.contents;
                if (rgrContents) {
                    for (const item of rgrContents) {
                        const content = item?.richItemRenderer?.content;
                        const vr = content?.videoRenderer;
                        if (vr) {
                            const parsed = this.parseArtistVideo(vr);
                            if (parsed) artVideos.push(parsed);
                        }
                    }
                }
            }

            const videoIds = artVideos.map(v => v.id);
            const artist_tracks = videoIds.length > 0 ? await this.fetch_track(videoIds) : [];

            this_artist = {
                source: "youtube",
                // etag: "",
                id: id,
                name: artName,
                thumbnail: artThumbnails?.[0]?.url ?? "",
                playlistId: id,
                tracks: []
            }
            writeArtist(this_artist)
            this.running = this.running.filter((item: { name: string }) => { return item.name !== `artist:${id}` })

            return {
                source: "youtube",
                name: artName,
                id: id,
                tracks: artist_tracks,
                thumbnail: artThumbnails?.[0]?.url ?? "",
                playlistId: id,
            }
        }
        catch (e) {
            this.running = this.running.filter((item: { name: string }) => { return item.name !== `artist:${id}` })
            this.log(e);
            return null as unknown as Artist;
        }
    }

    async get_new_tracks(ids: string[]) {
        try {
            const new_tracks: Track[] = []
            for (const id of ids) {
                try {
                    const data = await this.innertubeRequest<any>("browse", { browseId: id });
                    const videoIds: string[] = [];

                    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
                    for (const tab of tabs) {
                        const tabData = tab?.tabRenderer;
                        if (!tabData) continue;
                        const tabTitle: string = tabData.title ?? tabData.endpoint?.browseEndpoint?.params ?? "";
                        const tc = tabData.content;
                        if (!tc) continue;

                        const slrContents = tc?.sectionListRenderer?.contents;
                        if (slrContents) {
                            for (const section of slrContents) {
                                const isrItems = section?.itemSectionRenderer?.contents;
                                if (!isrItems) continue;
                                for (const item of isrItems) {
                                    const shelf = item?.shelfRenderer;
                                    const cvpr = item?.channelVideoPlayerRenderer;
                                    if (tabTitle === "Videos" || tabTitle === "Home") {
                                        if (shelf) {
                                            const hlr = shelf?.content?.horizontalListRenderer?.items;
                                            if (hlr) {
                                                for (const hi of hlr) {
                                                    const parsed = this.parseGridVideoRenderer(hi?.gridVideoRenderer);
                                                    if (parsed) videoIds.push(parsed.id)
                                                }
                                            }
                                            const escrItems = shelf?.content?.expandedShelfContentsRenderer?.items;
                                            if (escrItems) {
                                                for (const ei of escrItems) {
                                                    const parsed = this.parseArtistVideo(ei?.videoRenderer);
                                                    if (parsed) videoIds.push(parsed.id)
                                                }
                                            }
                                        }
                                        if (cvpr?.videoId) {
                                            const parsed = this.parseArtistVideo({
                                                videoId: cvpr.videoId, title: cvpr.title, thumbnail: cvpr.thumbnail,
                                            });
                                            if (parsed) videoIds.push(parsed.id)
                                        }
                                    }
                                }
                            }
                        }

                        const rgrContents = tc?.richGridRenderer?.contents;
                        if (rgrContents) {
                            for (const item of rgrContents) {
                                const content = item?.richItemRenderer?.content;
                                const vr = content?.videoRenderer;
                                if (vr) {
                                    const parsed = this.parseArtistVideo(vr);
                                    if (parsed) videoIds.push(parsed.id)
                                }
                            }
                        }
                    }

                    new_tracks.push(...(await this.fetch_track(videoIds.slice(0, 6))));
                    // for (const videoId of videoIds.slice(0, 6)) {
                    //     const video = await this.fetch_track([videoId])
                    //     new_tracks.push({
                    //         etag: "",
                    //         source: "youtube",
                    //         thumbnail: video.thumbnails?.[0]?.url ?? "",
                    //         artist: [{ name: video.artist ?? "", id: video.channelId ?? "" }],
                    //         name: video.title ?? "",
                    //         id: video.id,
                    //         duration: (video.duration ?? 0) * 1000,
                    //         releasedDate: video.publishedAt ?? "",
                    //     });
                    // }
                }
                catch (e) {
                    this.log(e);
                }
            }

            return new_tracks;
        } catch (e) {
            this.log(e);
            return []
        }
    }
}
