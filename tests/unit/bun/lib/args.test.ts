import { describe, expect, test } from "bun:test";
import { parseAppArgs } from "../../../../src/bun/lib/args.ts";

describe("parseAppArgs", () => {
    test("returns defaults when no flags are present", () => {
        expect(parseAppArgs([])).toEqual({ dataDir: "", assetsDir: "", noLock: false });
        expect(parseAppArgs(["bun", "index.ts"])).toEqual({ dataDir: "", assetsDir: "", noLock: false });
        expect(parseAppArgs([]).port).toBeUndefined();
    });

    test("parses every supported flag", () => {
        const args = parseAppArgs(["--data-dir", "C:\\data", "--assets", "C:\\assets", "--port", "8080", "--no-lock"]);
        expect(args).toEqual({ dataDir: "C:\\data", assetsDir: "C:\\assets", port: 8080, noLock: true });
    });

    test("treats port 0 as a valid ephemeral port", () => {
        expect(parseAppArgs(["--port", "0"]).port).toBe(0);
    });

    test("ignores a non-numeric port", () => {
        expect(parseAppArgs(["--port", "abc"]).port).toBeUndefined();
        expect(parseAppArgs(["--port", "12px"]).port).toBeUndefined();
    });

    test("uses an empty string when a flag has no value", () => {
        expect(parseAppArgs(["--data-dir"]).dataDir).toBe("");
        expect(parseAppArgs(["--assets"]).assetsDir).toBe("");
        expect(parseAppArgs(["--port"]).port).toBeUndefined();
    });

    test("ignores unknown flags", () => {
        expect(parseAppArgs(["--verbose", "--data-dir", "d"]).dataDir).toBe("d");
        expect(parseAppArgs(["--verbose"]).dataDir).toBe("");
    });

    test("lets the last occurrence win", () => {
        expect(parseAppArgs(["--port", "1", "--port", "2"]).port).toBe(2);
        expect(parseAppArgs(["--data-dir", "a", "--data-dir", "b"]).dataDir).toBe("b");
    });
});
