import { describe, expect, test } from "bun:test";
import getLocalIPv4 from "../../../../src/bun/lib/ipv4.ts";

describe("getLocalIPv4", () => {
    test("returns an IPv4-looking string", () => {
        const address = getLocalIPv4();
        expect(typeof address).toBe("string");
        expect(address).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
    });

    test("never returns an empty string", () => {
        expect(getLocalIPv4().length).toBeGreaterThan(0);
    });
});
