import { describe, expect, test } from "bun:test";
import formatArtists from "../../../src/shared/utils/formatArtist.ts";

type ArtistRef = { name: string; id: string };

describe("formatArtists", () => {
    test("joins artist names with commas", () => {
        expect(formatArtists([{ name: "Artist A", id: "1" }, { name: "Artist B", id: "2" }])).toBe("Artist A, Artist B");
    });

    test("keeps a single artist unchanged", () => {
        expect(formatArtists([{ name: "Solo", id: "x" }])).toBe("Solo");
    });

    test("keeps unicode and emoji names intact", () => {
        expect(formatArtists([{ name: "Artist with 你好", id: "1" }, { name: "Another Artist with 🎵", id: "2" }]))
            .toBe("Artist with 你好, Another Artist with 🎵");
    });

    test("returns an empty string for an empty list", () => {
        expect(formatArtists([])).toBe("");
    });

    test("returns an empty string for nullish input", () => {
        expect(formatArtists(undefined as unknown as ArtistRef[])).toBe("");
        expect(formatArtists(null as unknown as ArtistRef[])).toBe("");
    });
});
