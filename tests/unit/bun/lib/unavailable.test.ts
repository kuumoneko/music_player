import { describe, expect, test } from "bun:test";
import { isPermanentUnavailable } from "../../../../src/bun/lib/unavailable.ts";

describe("isPermanentUnavailable", () => {
    test("treats missing reasons as recoverable", () => {
        expect(isPermanentUnavailable(null)).toBe(false);
        expect(isPermanentUnavailable(undefined)).toBe(false);
        expect(isPermanentUnavailable("")).toBe(false);
    });

    test("recognises permanently unavailable videos", () => {
        const permanent = [
            "Video removed",
            "This video is private",
            "Video unavailable",
            "This video is not available in your country",
            "Blocked on copyright grounds",
            "Invalid response",
            "This video does not exist",
            "channel terminated",
            "deleted",
            "copyright",
            "disabled",
            "ERROR",
        ];
        for (const reason of permanent) {
            expect(isPermanentUnavailable(reason)).toBe(true);
        }
    });

    test("never treats transient failures as permanent", () => {
        const transient = [
            "Sign in to confirm you're not a bot",
            "cookie consent required",
            "quota exceeded",
            "too many requests",
            "network timeout",
            "temporary failure, try again",
            "no streaming data found",
            "login",
            "confirm",
            "resolver",
            "bot",
            "temporar",
        ];
        for (const reason of transient) {
            expect(isPermanentUnavailable(reason)).toBe(false);
        }
    });

    test("returns false for unrelated messages", () => {
        expect(isPermanentUnavailable("something unexpected happened")).toBe(false);
    });
});
