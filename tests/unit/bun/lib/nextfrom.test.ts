import { describe, expect, test } from "bun:test";
import { isValidContextEntry } from "../../../../src/bun/lib/nextfrom.ts";

describe("isValidContextEntry", () => {
    test("accepts nullish and empty entries", () => {
        expect(isValidContextEntry(null)).toBe(true);
        expect(isValidContextEntry(undefined)).toBe(true);
        expect(isValidContextEntry("")).toBe(true);
    });

    test("accepts well-formed local entries", () => {
        expect(isValidContextEntry("local:local:any-id")).toBe(true);
        expect(isValidContextEntry("local:track:whatever")).toBe(true);
    });

    test("validates youtube track ids", () => {
        expect(isValidContextEntry("youtube:track:dQw4w9WgXcQ")).toBe(true);
        expect(isValidContextEntry("youtube:track:short")).toBe(false);
        expect(isValidContextEntry("youtube:track:toolongvideoid")).toBe(false);
        expect(isValidContextEntry("youtube:track:has spaces!")).toBe(false);
    });

    test("validates youtube artist ids", () => {
        expect(isValidContextEntry("youtube:artist:UCabc123")).toBe(true);
        expect(isValidContextEntry("youtube:artist:UUabc123")).toBe(true);
        expect(isValidContextEntry("youtube:artist:@handle")).toBe(true);
        expect(isValidContextEntry("youtube:artist:dQw4w9WgXcQ")).toBe(false);
    });

    test("validates youtube playlist ids", () => {
        for (const id of ["PLabc", "OLAK5uy_abc", "UUabc", "RDabc", "VLabc"]) {
            expect(isValidContextEntry(`youtube:playlist:${id}`)).toBe(true);
        }
        expect(isValidContextEntry("youtube:playlist:UCabc")).toBe(false);
    });

    test("rejects unknown sources, unknown types and malformed shapes", () => {
        expect(isValidContextEntry("spotify:track:dQw4w9WgXcQ")).toBe(false);
        expect(isValidContextEntry("youtube:album:PLabc")).toBe(false);
        expect(isValidContextEntry("youtube:track:")).toBe(false);
        expect(isValidContextEntry("youtube::dQw4w9WgXcQ")).toBe(false);
        expect(isValidContextEntry("youtube:track:dQw4w9WgXcQ:extra")).toBe(false);
        expect(isValidContextEntry("youtube")).toBe(false);
    });
});
