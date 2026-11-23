import { describe, expect, test } from "bun:test";
import {
    clearThumbnail,
    deleteStaleTrackArtists,
    deleteTracks,
    getTrackByName,
    getTracks,
    markTracksDeleted,
    writeTracks,
} from "../../../../src/bun/db/index.ts";
import type { Track } from "../../../../src/shared/types.ts";

let counter = 0;

function makeTrack(overrides: Partial<Track> = {}): Track {
    counter++;
    return {
        id: `track-${Date.now()}-${counter}`,
        name: `Track ${counter}`,
        source: "local" as Track["source"],
        thumbnail: "https://img.example/cover.jpg",
        duration: 3_000,
        releasedDate: "2024-05-01",
        artist: [{ id: `artist-${counter}`, name: "Test Artist" }],
        ...overrides,
    };
}

describe("writeTracks / getTracks", () => {
    test("writes a track and reads it back with its artists", () => {
        const track = makeTrack({ name: "Roundtrip Song" });
        writeTracks([track]);

        const [stored] = getTracks([track.id]);
        expect(stored?.id).toBe(track.id);
        expect(stored?.name).toBe("Roundtrip Song");
        expect(stored?.duration).toBe(3_000);
        expect(stored?.releasedDate).toBe("2024-05-01");
        expect(stored?.artist).toEqual([{ id: track.artist[0]!.id, name: "Test Artist" }]);
    });

    test("writes several tracks and reads a subset", () => {
        const first = makeTrack({ name: "Batch One" });
        const second = makeTrack({ name: "Batch Two" });
        writeTracks([first, second]);

        const stored = getTracks([first.id, second.id]);
        expect(stored.map((track) => track.name).sort()).toEqual(["Batch One", "Batch Two"]);
    });

    test("upserts an existing track instead of duplicating it", () => {
        const track = makeTrack({ name: "Before" });
        writeTracks([track]);
        writeTracks([{ ...track, name: "After", duration: 9_999 }]);

        const stored = getTracks([track.id]);
        expect(stored).toHaveLength(1);
        expect(stored[0]?.name).toBe("After");
        expect(stored[0]?.duration).toBe(9_999);
    });

    test("returns an empty list for no ids or unknown ids", () => {
        expect(getTracks([])).toEqual([]);
        expect(getTracks([`unknown-${Date.now()}`])).toEqual([]);
    });

    test("finds tracks by name substring and exactly", () => {
        const unique = `UniqueSearch${Date.now()}`;
        writeTracks([makeTrack({ name: `${unique} Extended` })]);

        expect(getTrackByName(unique).map((track) => track.name)).toContain(`${unique} Extended`);
        expect(getTrackByName(`${unique} Extended`, true)).toHaveLength(1);
        expect(getTrackByName(unique, true)).toEqual([]);
    });
});

describe("track deletion", () => {
    test("markTracksDeleted hides youtube tracks from reads", () => {
        const track = makeTrack({
            name: "Deleted Youtube",
            source: "youtube" as Track["source"],
            id: `yt-${Date.now()}`,
        });
        writeTracks([track]);

        markTracksDeleted([track.id]);
        expect(getTracks([track.id])).toEqual([]);

        // Rewriting the row clears the deleted flag.
        writeTracks([track]);
        expect(getTracks([track.id])).toHaveLength(1);
    });

    test("markTracksDeleted ignores local tracks", () => {
        const track = makeTrack({ name: "Local Keep" });
        writeTracks([track]);

        markTracksDeleted([track.id]);
        expect(getTracks([track.id])).toHaveLength(1);
    });

    test("deleteTracks removes rows and tolerates nullish ids", () => {
        const track = makeTrack({ name: "Permanent Delete" });
        writeTracks([track]);

        deleteTracks([track.id, null, undefined]);
        expect(getTracks([track.id])).toEqual([]);
    });

    test("deleteStaleTrackArtists unlinks tracks that are no longer valid", () => {
        const artistId = `artist-stale-${Date.now()}`;
        const keep = makeTrack({ name: "Keep Link", artist: [{ id: artistId, name: "Stale Artist" }] });
        const drop = makeTrack({ name: "Drop Link", artist: [{ id: artistId, name: "Stale Artist" }] });
        writeTracks([keep, drop]);

        deleteStaleTrackArtists(artistId, [keep.id]);

        expect(getTracks([keep.id])[0]?.artist).toEqual([{ id: artistId, name: "Stale Artist" }]);
        expect(getTracks([drop.id])[0]?.artist).toEqual([]);
    });

    test("deleteStaleTrackArtists removes every link when no ids are valid", () => {
        const artistId = `artist-all-${Date.now()}`;
        const track = makeTrack({ name: "All Gone", artist: [{ id: artistId, name: "Gone" }] });
        writeTracks([track]);

        deleteStaleTrackArtists(artistId, []);
        expect(getTracks([track.id])[0]?.artist).toEqual([]);
    });
});

describe("clearThumbnail", () => {
    test("clears a refused thumbnail on every matching row", () => {
        const thumbnail = `https://img.example/broken-${Date.now()}.jpg`;
        const first = makeTrack({ thumbnail, name: "Thumb One" });
        const second = makeTrack({ thumbnail, name: "Thumb Two" });
        writeTracks([first, second]);

        clearThumbnail(thumbnail);

        expect(getTracks([first.id])[0]?.thumbnail).toBe("");
        expect(getTracks([second.id])[0]?.thumbnail).toBe("");
    });

    test("ignores empty thumbnails", () => {
        const track = makeTrack({ thumbnail: "" });
        writeTracks([track]);
        expect(() => clearThumbnail("")).not.toThrow();
        expect(getTracks([track.id])[0]?.thumbnail).toBe("");
    });
});
