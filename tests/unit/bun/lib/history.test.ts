import { beforeEach, describe, expect, test } from "bun:test";
import { recordPlayed } from "../../../../src/bun/lib/history.ts";
import { getUserData, writeUserData } from "../../../../src/bun/db/index.ts";

beforeEach(() => {
    writeUserData("playedTrack", []);
});

describe("recordPlayed", () => {
    test("returns a single id for the first play", () => {
        expect(recordPlayed("track-a")).toEqual(["track-a"]);
    });

    test("appends new ids to the end", () => {
        recordPlayed("a");
        recordPlayed("b");
        expect(recordPlayed("c")).toEqual(["a", "b", "c"]);
    });

    test("moves a repeated id to the end without duplicating it", () => {
        recordPlayed("a");
        recordPlayed("b");
        expect(recordPlayed("a")).toEqual(["b", "a"]);
    });

    test("ignores empty ids and returns the current history", () => {
        recordPlayed("a");
        expect(recordPlayed("")).toEqual(["a"]);
        expect(getUserData("playedTrack")).toEqual(["a"]);
    });

    test("caps the history at 100 entries", () => {
        for (let index = 0; index < 101; index++) {
            recordPlayed(`track-${index}`);
        }

        const history = getUserData("playedTrack") ?? [];
        expect(history).toHaveLength(100);
        expect(history[0]).toBe("track-1");
        expect(history[99]).toBe("track-100");
    });

    test("persists the history in user data", () => {
        recordPlayed("persisted");
        expect(getUserData("playedTrack")).toEqual(["persisted"]);
    });
});
