import { MusicSource, MusicType, HomeFeedSection, Track, Artist, Playlist } from "../../shared/types.ts";
import Player from "../music/index.ts";
import { parseBrowseResponse } from "../music/youtube/InnerTube/browse-parser";
import { getPlaylist, getUserData, writeLogs, writeUserData } from "../db/index.ts";
import { isPinBroken } from "../music/youtube-data-api/index.ts";
import { Resource } from "../cache/resource.ts";

interface Pin {
    source: MusicSource,
    type: MusicType,
    id: string
}

function parsePins(pin: string[]): Pin[] {
    return pin.map(item => {
        const [source, type, id] = item.split(":")
        return { source: source as MusicSource, type: type as MusicType, id }
    })
}

export interface HomeData {
    artists: (Artist | null)[],
    playlists: (Playlist | null)[],
    newTracks: Track[],
    tracks: Track[],
}

const CACHE_TTL = 30_000;
const HOME_RESOURCE_MAX = 5;
const homeResources = new Map<string, Resource<HomeData>>();
const HOME_FEED_TTL = 30 * 60_000;
const HOME_FEED_RESOURCE_MAX = 5;
const homeFeedResources = new Map<string, Resource<{ sections: HomeFeedSection[] }>>();
let emitDataChanged: ((key: string) => void) | null = null;

export function setHomeEmitDataChanged(fn: (key: string) => void) {
    emitDataChanged = fn;
}

export function clearHomeCaches() {
    homeResources.clear();
    homeFeedResources.clear();
}

async function loadHomeData(player: Player, pin: string[]): Promise<{ data: HomeData; complete?: boolean } | null> {
    const newPins = parsePins(pin);
    const artistPins = newPins.filter((item: Pin) => item.type === MusicType.Artist && !isPinBroken(`${item.source}:${item.type}:${item.id}`));
    const playlistPins = newPins.filter((item: Pin) => item.type === MusicType.Playlist);
    const trackPins = newPins.filter((item: Pin) => item.type === MusicType.Track);

    const [pinArtists, pinPlaylists, pinTracks, ytbNewTracks] = await Promise.all([
        Promise.all(artistPins.map((item: Pin) => player.youtubeDataAPI.fetchArtist(item.id, true).catch(() => null))),
        Promise.all(playlistPins.map((item: Pin) => {
            if (item.source === MusicSource.Local) return getPlaylist(item.id, true);
            return player.youtubeDataAPI.fetchPlaylist(item.id, true).catch(() => null);
        })),
        player.youtubeDataAPI.fetchTrack(trackPins.map(item => item.id)).catch(() => []),
        player.youtubeDataAPI.getNewTracks(artistPins.map((item: Pin) => item.id).filter(item => item !== undefined)).catch(() => []),
    ]);

    return { data: { artists: pinArtists, playlists: pinPlaylists, newTracks: ytbNewTracks, tracks: pinTracks }, complete: true };
}

function getHomeResource(player: Player, pin: string[]): Resource<HomeData> {
    const key = `homeFeed:${JSON.stringify(pin)}`;
    let resource = homeResources.get(key);
    if (!resource) {
        resource = new Resource<HomeData>({
            key,
            ttl: CACHE_TTL,
            loadPartial: () => loadHomeData(player, pin),
            loadFull: () => loadHomeData(player, pin),
            emit: () => emitDataChanged?.("homeFeed"),
        });
        homeResources.set(key, resource);
        if (homeResources.size > HOME_RESOURCE_MAX) {
            const oldest = homeResources.keys().next().value as string;
            homeResources.delete(oldest);
            writeLogs([{ type: "info", message: `Home resource evicted: ${oldest}` }]);
        }
    }
    return resource;
}

export default async function HomeController(player: Player, pin: string[] | null): Promise<HomeData> {
    if (pin === null) {
        return { artists: [], playlists: [], newTracks: [], tracks: [] }
    }
    return await getHomeResource(player, pin).get();
}

export async function getHomeArtists(player: Player, pin: string[]): Promise<Artist[]> {
    const newPins = parsePins(pin);
    const artistPins = newPins.filter((item: Pin) => item.type === MusicType.Artist && !isPinBroken(`${item.source}:${item.type}:${item.id}`));
    const results = await Promise.all(artistPins.map(item => player.youtubeDataAPI.fetchArtist(item.id, true).catch(() => null)));
    return results.filter((a): a is Artist => a !== null);
}

export async function getHomePlaylists(player: Player, pin: string[]): Promise<Playlist[]> {
    const newPins = parsePins(pin);
    const playlistPins = newPins.filter((item: Pin) => item.type === MusicType.Playlist);
    const results = await Promise.all(playlistPins.map(item => {
        if (item.source === MusicSource.Local) return getPlaylist(item.id, true);
        return player.youtubeDataAPI.fetchPlaylist(item.id, true).catch(() => null);
    }));
    return results.filter((p): p is Playlist => p !== null);
}

export async function getHomeTracks(player: Player, pin: string[]): Promise<Track[]> {
    const newPins = parsePins(pin);
    const trackPins = newPins.filter((item: Pin) => item.type === MusicType.Track);
    const results = await player.youtubeDataAPI.fetchTrack(trackPins.map(item => item.id)).catch(() => []);
    return results.filter((t): t is Track => t !== null);
}

export async function getHomeNewTracks(player: Player, pin: string[]): Promise<Track[]> {
    const newPins = parsePins(pin);
    const artistPins = newPins.filter((item: Pin) => item.type === MusicType.Artist && !isPinBroken(`${item.source}:${item.type}:${item.id}`));
    const results = await player.youtubeDataAPI.getNewTracks(artistPins.map((item: Pin) => item.id).filter(Boolean)).catch(() => []);
    results.sort((a, b) => new Date(b.releasedDate).getTime() - new Date(a.releasedDate).getTime());
    return results;
}

function parseBrowseItem(item: { id: string; title: string; type: "video" | "playlist" | "channel"; artist?: string; channelId?: string; duration?: number; thumbnail: string }): Track | Artist | Playlist | null {
    if (item.type === "video") {
        return {
            source: MusicSource.Youtube,
            id: item.id,
            name: item.title,
            artist: item.artist ? [{ name: item.artist, id: item.channelId ?? "" }] : [],
            thumbnail: item.thumbnail,
            duration: (item.duration ?? 0) * 1000,
            releasedDate: "",
        } as Track;
    }
    if (item.type === "playlist") {
        return {
            source: MusicSource.Youtube,
            id: item.id,
            name: item.title,
            thumbnail: item.thumbnail,
            duration: 0,
        } as Playlist;
    }
    if (item.type === "channel") {
        return {
            source: MusicSource.Youtube,
            id: item.id,
            name: item.title,
            thumbnail: item.thumbnail,
            tracks: [],
            playlistId: "",
        } as Artist;
    }
    return null;
}

export async function HomeFeedController(player: Player, pin: string[] | null): Promise<{ sections: HomeFeedSection[] }> {
    return getHomeFeedResource(player, pin).get();
}

function getHomeFeedResource(player: Player, pin: string[] | null): Resource<{ sections: HomeFeedSection[] }> {
    const key = `homeFeedSections:${pin === null ? "none" : JSON.stringify(pin)}`;
    let resource = homeFeedResources.get(key);
    if (!resource) {
        resource = new Resource<{ sections: HomeFeedSection[] }>({
            key,
            ttl: HOME_FEED_TTL,
            loadPartial: () => loadHomeFeed(player, pin),
            loadFull: () => loadHomeFeed(player, pin),
            loadPersisted: () => {
                const data = getUserData("homeFeedSections");
                if (!data || !Array.isArray(data.sections) || typeof data.at !== "number") return null;
                return { data: { sections: data.sections }, at: data.at, complete: true };
            },
            persist: (state) => {
                writeUserData("homeFeedSections", { sections: state.data.sections, at: state.at });
            },
            emit: () => emitDataChanged?.("homeFeed"),
        });
        homeFeedResources.set(key, resource);
        if (homeFeedResources.size > HOME_FEED_RESOURCE_MAX) {
            const oldest = homeFeedResources.keys().next().value as string;
            homeFeedResources.delete(oldest);
            writeLogs([{ type: "info", message: `Home feed resource evicted: ${oldest}` }]);
        }
    }
    return resource;
}

async function loadHomeFeed(player: Player, pin: string[] | null): Promise<{ data: { sections: HomeFeedSection[] }; complete: boolean }> {
    const sections: HomeFeedSection[] = [];

    try {
        const browseData = await player.youtube?.browse("FEwhat_to_watch");
        if (browseData) {
            const parsed = parseBrowseResponse(browseData);
            for (const section of parsed) {
                const tracks: Track[] = [];
                const playlists: Playlist[] = [];
                const artists: Artist[] = [];
                for (const item of section.items) {
                    const parsed = parseBrowseItem(item);
                    if (parsed) {
                        if ("artist" in parsed) tracks.push(parsed as Track);
                        else if ("playlistId" in parsed) artists.push(parsed as Artist);
                        else playlists.push(parsed as Playlist);
                    }
                }
                if (tracks.length > 0) {
                    sections.push({ title: section.title, type: "mixed", items: tracks, itemType: "track" });
                }
                if (playlists.length > 0) {
                    sections.push({ title: section.title, type: "mixed", items: playlists, itemType: "playlist" });
                }
                if (artists.length > 0) {
                    sections.push({ title: section.title, type: "mixed", items: artists, itemType: "artist" });
                }
            }
        }
    } catch {}

    if (pin !== null) {
        const newPins = parsePins(pin);
        const artistPins = newPins.filter((item: Pin) => item.type === MusicType.Artist && !isPinBroken(`${item.source}:${item.type}:${item.id}`));
        const playlistPins = newPins.filter((item: Pin) => item.type === MusicType.Playlist);
        const trackPins = newPins.filter((item: Pin) => item.type === MusicType.Track);

        const [pinArtists, pinPlaylists, pinTracks, ytbNewTracks] = await Promise.all([
            Promise.all(artistPins.map(item => player.youtubeDataAPI.fetchArtist(item.id, true).catch(() => null))),
            Promise.all(playlistPins.map(item => {
                if (item.source === MusicSource.Local) return getPlaylist(item.id, true);
                return player.youtubeDataAPI.fetchPlaylist(item.id, true).catch(() => null);
            })),
            player.youtubeDataAPI.fetchTrack(trackPins.map(item => item.id)).catch(() => []),
            player.youtubeDataAPI.getNewTracks(artistPins.map(item => item.id).filter(Boolean)).catch(() => []),
        ]);

        const validArtists = pinArtists.filter((a): a is Artist => a !== null);
        const validPlaylists = pinPlaylists.filter((p): p is Playlist => p !== null);
        const validTracks = pinTracks.filter((t): t is Track => t !== null);

        if (validArtists.length > 0) {
            sections.push({ title: "Your Artists", type: "pinned_artists", items: validArtists, itemType: "artist" });
        }
        if (validPlaylists.length > 0) {
            sections.push({ title: "Your Playlists", type: "pinned_playlists", items: validPlaylists, itemType: "playlist" });
        }
        if (validTracks.length > 0) {
            sections.push({ title: "Your Tracks", type: "pinned_tracks", items: validTracks, itemType: "track" });
        }
        if (ytbNewTracks.length > 0) {
            ytbNewTracks.sort((a, b) => new Date(b.releasedDate).getTime() - new Date(a.releasedDate).getTime());
            sections.push({ title: "New From Your Artists", type: "pinned_new_tracks", items: ytbNewTracks, itemType: "track" });
        }
    }

    return { data: { sections }, complete: true };
}
