import { beforeEach, describe, expect, test } from "bun:test";
import {
    clearHashes,
    getHash,
    getPath,
    resolveId,
    trackToFront,
    tracksToFront,
} from "../../../../src/bun/lib/hash.ts";
import type { Track } from "../../../../src/shared/types.ts";

function makeTrack(id: string): Track {
    return {
        id,
        name: `Track ${id}`,
        source: "local" as Track["source"],
        thumbnail: "",
        duration: 1000,
        releasedDate: "2024-01-01",
        artist: [],
    };
}

beforeEach(() => {
    clearHashes();
});

describe("getHash / getPath", () => {
    test("is deterministic for the same path", () => {
        const first = getHash("C:\\music\\song.flac");
        expect(getHash("C:\\music\\song.flac")).toBe(first);
        expect(first).toMatch(/^[0-9a-f]+$/);
    });

    test("produces different hashes for different paths", () => {
        expect(getHash("C:\\music\\a.flac")).not.toBe(getHash("C:\\music\\b.flac"));
    });

    test("maps a hash back to its original path", () => {
        const hash = getHash("C:\\music\\mapped.flac");
        expect(getPath(hash)).toBe("C:\\music\\mapped.flac");
    });

    test("returns undefined for an unknown hash", () => {
        expect(getPath("not-a-real-hash")).toBeUndefined();
    });
});

describe("resolveId", () => {
    test("resolves a known hash to its path", () => {
        const hash = getHash("C:\\music\\known.flac");
        expect(resolveId(hash)).toBe("C:\\music\\known.flac");
    });

    test("passes unknown ids through unchanged", () => {
        expect(resolveId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
});

describe("trackToFront / tracksToFront", () => {
    test("replaces the track id with its path hash and keeps other fields", () => {
        const track = makeTrack("C:\\music\\front.flac");
        const front = trackToFront(track);
        expect(front.id).toBe(getHash("C:\\music\\front.flac"));
        expect(front.name).toBe(track.name);
        expect(front.duration).toBe(track.duration);
        expect(front.source).toBe(track.source);
    });

    test("maps every track in a list", () => {
        const front = tracksToFront([makeTrack("C:\\a.flac"), makeTrack("C:\\b.flac")]);
        expect(front.map((track) => track.id)).toEqual([
            getHash("C:\\a.flac"),
            getHash("C:\\b.flac"),
        ]);
    });
});

describe("clearHashes", () => {
    test("forgets every mapping", () => {
        const hash = getHash("C:\\music\\forget.flac");
        clearHashes();
        expect(getPath(hash)).toBeUndefined();
    });
});
