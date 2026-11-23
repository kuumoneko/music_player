import { describe, expect, test } from "bun:test";
import areStringsSimilar from "../../../src/bun/utils/compareString.ts";

describe("areStringsSimilar", () => {
    test("treats identical strings as similar", () => {
        expect(areStringsSimilar("hello", "hello")).toBe(true);
    });

    test("accepts small edits at the default threshold", () => {
        expect(areStringsSimilar("hello", "hallo")).toBe(true);
        expect(areStringsSimilar("kendrick lamar", "kendrick lamer")).toBe(true);
    });

    test("rejects clearly different strings", () => {
        expect(areStringsSimilar("hello", "world")).toBe(false);
        expect(areStringsSimilar("abc", "xyz")).toBe(false);
    });

    test("rejects empty strings unless both are empty", () => {
        expect(areStringsSimilar("", "")).toBe(true);
        expect(areStringsSimilar("", "abc")).toBe(false);
        expect(areStringsSimilar("abc", "")).toBe(false);
    });

    test("honours a custom threshold", () => {
        expect(areStringsSimilar("hello", "hallo", 0.95)).toBe(false);
        expect(areStringsSimilar("hello", "hallo", 0.5)).toBe(true);
    });
});
