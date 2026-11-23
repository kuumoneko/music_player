import { beforeEach, describe, expect, test } from "bun:test";
import db from "../../../../src/bun/db/setup.ts";
import { deleteLogs, pruneLogs, writeLogs } from "../../../../src/bun/db/index.ts";

interface LogRow {
    type: string;
    source: string | null;
    message: string;
}

function readLogs(): LogRow[] {
    return db.prepare("SELECT type, source, message FROM log ORDER BY id ASC").all() as LogRow[];
}

beforeEach(() => {
    deleteLogs();
});

describe("writeLogs", () => {
    test("stores type, source and message", () => {
        writeLogs([{ type: "error", source: "player", message: "playback failed" }]);
        expect(readLogs()).toEqual([{ type: "error", source: "player", message: "playback failed" }]);
    });

    test("defaults a missing source to null", () => {
        writeLogs([{ type: "info", message: "started" }]);
        expect(readLogs()[0]?.source).toBeNull();
    });

    test("writes every entry of a batch in order", () => {
        writeLogs([
            { type: "info", message: "first" },
            { type: "info", message: "second" },
            { type: "error", message: "third" },
        ]);
        expect(readLogs().map((row) => row.message)).toEqual(["first", "second", "third"]);
    });
});

describe("pruneLogs", () => {
    test("keeps only the newest rows", () => {
        writeLogs(Array.from({ length: 5 }, (_, index) => ({
            type: "info" as const,
            message: `log-${index}`,
        })));

        pruneLogs(2);
        expect(readLogs().map((row) => row.message)).toEqual(["log-3", "log-4"]);
    });

    test("keeps everything when the limit is larger than the table", () => {
        writeLogs([{ type: "info", message: "only" }]);
        pruneLogs(100);
        expect(readLogs()).toHaveLength(1);
    });

    test("can empty the table with a zero limit", () => {
        writeLogs([{ type: "info", message: "a" }, { type: "info", message: "b" }]);
        pruneLogs(0);
        expect(readLogs()).toEqual([]);
    });
});

describe("deleteLogs", () => {
    test("removes every row", () => {
        writeLogs([{ type: "info", message: "leftover" }]);
        deleteLogs();
        expect(readLogs()).toEqual([]);
    });
});
