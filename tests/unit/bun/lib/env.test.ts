import { beforeEach, describe, expect, test } from "bun:test";
import db from "../../../../src/bun/db/setup.ts";
import CheckUserData from "../../../../src/bun/lib/env.ts";
import { getUserData, writeLogs, writeUserData } from "../../../../src/bun/db/index.ts";

beforeEach(() => {
    db.run("DELETE FROM user_data;");
    db.run("DELETE FROM playlists;");
    db.run("DELETE FROM log;");
});

describe("CheckUserData defaults", () => {
    test("seeds every missing default", () => {
        CheckUserData();

        expect(getUserData("repeat")).toBe(0);
        expect(getUserData("shuffle")).toBe(0);
        expect(getUserData("volume")).toBe(50);
        expect(getUserData("folder")).toBe("");
        expect(getUserData("playedTrack")).toEqual([]);
        expect(getUserData("isPlaying")).toBe(false);
        expect(getUserData("isLoading")).toBe(false);
        expect(getUserData("QuitOnClose")).toBe(false);
        expect(getUserData("closeToTray")).toBe(false);
        expect(getUserData("current")).toEqual({ duration: 0, isLived: false });
        expect(getUserData("playQueue")).toEqual([]);
        expect(getUserData("batchQueue")).toEqual([]);
        expect(getUserData("downloadQueue")).toEqual([]);
        expect(getUserData("pin")).toEqual([]);
        expect(getUserData("nextfrom")).toBe("");
    });

    test("does not overwrite values that already exist", () => {
        writeUserData("volume", 77);
        writeUserData("folder", "D:\\Music");
        writeUserData("playedTrack", ["existing"]);

        CheckUserData();

        expect(getUserData("volume")).toBe(77);
        expect(getUserData("folder")).toBe("D:\\Music");
        expect(getUserData("playedTrack")).toEqual(["existing"]);
    });

    test("is idempotent across repeated calls", () => {
        CheckUserData();
        CheckUserData();

        expect(getUserData("volume")).toBe(50);
        expect(getUserData("folder")).toBe("");
    });
});

describe("CheckUserData cleanup", () => {
    test("removes invalid empty youtube playlists but keeps valid ones", () => {
        db.run("INSERT INTO playlists (id, name, source) VALUES (?, ?, ?)", ["UCnotaplaylist", "Bad", "youtube"]);
        db.run("INSERT INTO playlists (id, name, source) VALUES (?, ?, ?)", ["PLvalid123", "Good", "youtube"]);

        CheckUserData();

        const rows = db.prepare("SELECT id FROM playlists ORDER BY id").all() as { id: string }[];
        expect(rows.map((row) => row.id)).toEqual(["PLvalid123"]);
    });

    test("keeps an invalid-looking youtube playlist that still has tracks", () => {
        db.run("INSERT INTO playlists (id, name, source) VALUES (?, ?, ?)", ["UCwithtracks", "Kept", "youtube"]);
        db.run(
            "INSERT INTO tracks (id, name, source, duration) VALUES (?, ?, ?, ?)",
            ["track-kept", "Track", "youtube", 1],
        );
        db.run(
            "INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)",
            ["UCwithtracks", "track-kept"],
        );

        CheckUserData();

        const row = db.prepare("SELECT id FROM playlists WHERE id = ?").get("UCwithtracks") as { id: string } | null;
        expect(row?.id).toBe("UCwithtracks");
    });

    test("prunes the log table to the newest rows", () => {
        writeLogs(Array.from({ length: 5 }, (_, index) => ({
            type: "info" as const,
            message: `env-log-${index}`,
        })));

        CheckUserData();

        // CheckUserData prunes with the production limit, so all five survive.
        const count = db.prepare("SELECT COUNT(*) AS total FROM log").get() as { total: number };
        expect(count.total).toBe(5);
    });
});
