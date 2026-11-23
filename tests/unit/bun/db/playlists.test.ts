import { describe, expect, test } from "bun:test";
import {
    addTrackToPlaylist,
    clearPlaylistMissing,
    createPlaylist,
    deletePlaylist,
    getAllPlaylists,
    getPlaylist,
    isPlaylistMissing,
    markPlaylistMissing,
    removeTrackFromPlaylist,
} from "../../../../src/bun/db/index.ts";
import { MusicSource, type Track } from "../../../../src/shared/types.ts";

function makeTrack(id: string, name: string): Track {
    return {
        id,
        name,
        source: "local" as Track["source"],
        thumbnail: "",
        duration: 2_000,
        releasedDate: "2024-01-01",
        artist: [{ id: `artist-${id}`, name: "Test Artist" }],
    };
}

describe("playlist lifecycle", () => {
    test("creates a local playlist with a generated id", () => {
        const playlist = createPlaylist("Road Trip");
        expect(playlist.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(playlist.name).toBe("Road Trip");
        expect(playlist.source).toBe(MusicSource.Local);
        expect(playlist.tracks).toEqual([]);
        expect(playlist.ids).toEqual([]);

        const stored = getPlaylist(playlist.id);
        expect(stored?.name).toBe("Road Trip");
        expect(stored?.ids).toEqual([]);
    });

    test("lists local playlists newest first", () => {
        const older = createPlaylist("Older Playlist");
        const newer = createPlaylist("Newer Playlist");

        const ids = getAllPlaylists().map((playlist) => playlist.id);
        expect(ids).toContain(older.id);
        expect(ids).toContain(newer.id);
        expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    });

    test("adds a track and exposes it through getPlaylist", () => {
        const playlist = createPlaylist("With Tracks");
        const track = makeTrack(`pl-track-${Date.now()}`, "Playlist Track");

        addTrackToPlaylist(playlist.id, track);

        const stored = getPlaylist(playlist.id);
        expect(stored?.ids).toEqual([track.id]);
        expect(stored?.tracks?.map((item) => item.id)).toEqual([track.id]);
    });

    test("adding the same track twice does not duplicate it", () => {
        const playlist = createPlaylist("No Duplicates");
        const track = makeTrack(`pl-dup-${Date.now()}`, "Only Once");

        addTrackToPlaylist(playlist.id, track);
        addTrackToPlaylist(playlist.id, track);

        expect(getPlaylist(playlist.id)?.ids).toEqual([track.id]);
    });

    test("removes a track without deleting the playlist", () => {
        const playlist = createPlaylist("Remove Track");
        const track = makeTrack(`pl-remove-${Date.now()}`, "Removable");
        addTrackToPlaylist(playlist.id, track);

        removeTrackFromPlaylist(playlist.id, track.id);

        const stored = getPlaylist(playlist.id);
        expect(stored).not.toBeNull();
        expect(stored?.ids).toEqual([]);
        expect(stored?.tracks ?? []).toEqual([]);
    });

    test("deletes a playlist", () => {
        const playlist = createPlaylist("Temporary");
        deletePlaylist(playlist.id);
        expect(getPlaylist(playlist.id)).toBeNull();
        expect(getAllPlaylists().map((item) => item.id)).not.toContain(playlist.id);
    });

    test("returns null for an unknown playlist", () => {
        expect(getPlaylist(`missing-${Date.now()}`)).toBeNull();
    });
});

describe("playlist missing marker", () => {
    test("is not missing by default", () => {
        const playlist = createPlaylist("Healthy");
        expect(isPlaylistMissing(playlist.id, 60_000)).toBe(false);
    });

    test("remembers a missing playlist until the TTL expires", () => {
        const playlist = createPlaylist("Missing");
        markPlaylistMissing(playlist.id);

        expect(isPlaylistMissing(playlist.id, 60_000)).toBe(true);
        expect(isPlaylistMissing(playlist.id, 0)).toBe(false);

        clearPlaylistMissing(playlist.id);
        expect(isPlaylistMissing(playlist.id, 60_000)).toBe(false);
    });

    test("reports unknown playlists as not missing", () => {
        expect(isPlaylistMissing(`unknown-${Date.now()}`, 60_000)).toBe(false);
    });
});
