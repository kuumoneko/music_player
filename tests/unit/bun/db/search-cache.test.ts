import { describe, expect, test } from "bun:test";
import db from "../../../../src/bun/db/setup.ts";
import {
    getSearchCache,
    purgeExpiredSearchCache,
    setSearchCache,
} from "../../../../src/bun/db/index.ts";
import type { SearchResult } from "../../../../src/shared/types.ts";

const emptyResult: SearchResult = { tracks: [], playlists: [], artists: [] };

function resultWith(trackName: string): SearchResult {
    return {
        tracks: [{
            id: "dQw4w9WgXcQ",
            name: trackName,
            artist: [{ id: "UC1", name: "Artist" }],
            source: "youtube" as SearchResult["tracks"][number]["source"],
            thumbnail: "",
            duration: 1000,
            releasedDate: "",
        }],
        playlists: [],
        artists: [],
    };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("search cache", () => {
    test("returns null for an unknown key", () => {
        expect(getSearchCache(`missing-${Date.now()}`)).toBeNull();
    });

    test("stores and retrieves a search result", () => {
        const key = `roundtrip-${Date.now()}`;
        setSearchCache(key, resultWith("Stored Track"));
        expect(getSearchCache(key)?.tracks[0]?.name).toBe("Stored Track");
    });

    test("overwrites an existing entry", () => {
        const key = `overwrite-${Date.now()}`;
        setSearchCache(key, resultWith("First"));
        setSearchCache(key, resultWith("Second"));
        expect(getSearchCache(key)?.tracks[0]?.name).toBe("Second");
    });

    test("ignores entries older than the 24h TTL", () => {
        const key = `expired-${Date.now()}`;
        db.run(
            "INSERT INTO search_cache (search_key, data, fetched_at) VALUES (?, ?, ?)",
            [key, JSON.stringify(emptyResult), Date.now() - DAY_MS - 60_000],
        );
        expect(getSearchCache(key)).toBeNull();
    });

    test("purges expired rows and keeps fresh ones", () => {
        const expiredKey = `purge-old-${Date.now()}`;
        const freshKey = `purge-new-${Date.now()}`;
        db.run(
            "INSERT INTO search_cache (search_key, data, fetched_at) VALUES (?, ?, ?)",
            [expiredKey, JSON.stringify(emptyResult), Date.now() - DAY_MS - 60_000],
        );
        setSearchCache(freshKey, emptyResult);

        expect(purgeExpiredSearchCache()).toBeGreaterThanOrEqual(1);
        expect(getSearchCache(freshKey)).toEqual(emptyResult);
        expect(getSearchCache(expiredKey)).toBeNull();
    });

    test("returns null for corrupted JSON instead of throwing", () => {
        const key = `corrupt-${Date.now()}`;
        db.run(
            "INSERT INTO search_cache (search_key, data, fetched_at) VALUES (?, ?, ?)",
            [key, "{not-json", Date.now()],
        );
        expect(getSearchCache(key)).toBeNull();
    });
});
