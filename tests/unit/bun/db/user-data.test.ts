import { describe, expect, test } from "bun:test";
import {
    KeyType,
    decodeValue,
    encodeValue,
    getUserValueType,
} from "../../../../src/bun/db/user/shared/utils.ts";
import {
    getUserData,
    getUserDatas,
    writeUserData,
    writeUserDatas,
} from "../../../../src/bun/db/index.ts";

describe("getUserValueType", () => {
    test("classifies numeric keys", () => {
        for (const key of ["repeat", "shuffle", "volume"]) {
            expect(getUserValueType(key)).toBe(KeyType.Number);
        }
    });

    test("classifies boolean keys", () => {
        for (const key of ["QuitOnClose", "closeToTray", "isPlaying", "isLoading"]) {
            expect(getUserValueType(key)).toBe(KeyType.Boolean);
        }
    });

    test("classifies string keys", () => {
        expect(getUserValueType("folder")).toBe(KeyType.String);
    });

    test("defaults everything else to JSON", () => {
        expect(getUserValueType("playQueue")).toBe(KeyType.JSON);
        expect(getUserValueType("current")).toBe(KeyType.JSON);
        expect(getUserValueType("unknown-key")).toBe(KeyType.JSON);
    });
});

describe("encodeValue / decodeValue", () => {
    test("round-trips numbers", () => {
        expect(encodeValue("volume", 42)).toBe("42");
        expect(decodeValue("volume", "42")).toBe(42);
        expect(decodeValue("repeat", "2")).toBe(2);
    });

    test("round-trips booleans as 1/0", () => {
        expect(encodeValue("isPlaying", true)).toBe("1");
        expect(encodeValue("isPlaying", false)).toBe("0");
        expect(decodeValue("isPlaying", "1")).toBe(true);
        expect(decodeValue("isPlaying", "0")).toBe(false);
        expect(decodeValue("isPlaying", "true")).toBe(false);
    });

    test("round-trips strings", () => {
        expect(encodeValue("folder", "D:\\Music")).toBe("D:\\Music");
        expect(decodeValue("folder", "D:\\Music")).toBe("D:\\Music");
        expect(encodeValue("folder", 123)).toBe("123");
    });

    test("round-trips JSON values", () => {
        const queue = ["a", "b", "c"];
        expect(encodeValue("playQueue", queue)).toBe(JSON.stringify(queue));
        expect(decodeValue("playQueue", JSON.stringify(queue))).toEqual(queue);
        expect(decodeValue("current", '{"duration":12,"isLived":false}')).toEqual({ duration: 12, isLived: false });
    });
});

describe("user data persistence", () => {
    test("stores and retrieves values of every type", () => {
        writeUserData("volume", 33);
        writeUserData("closeToTray", true);
        writeUserData("folder", "E:\\Music");
        writeUserData("playQueue", ["one", "two"]);

        expect(getUserData("volume")).toBe(33);
        expect(getUserData("closeToTray")).toBe(true);
        expect(getUserData("folder")).toBe("E:\\Music");
        expect(getUserData("playQueue")).toEqual(["one", "two"]);
    });

    test("overwrites existing values", () => {
        writeUserData("volume", 10);
        writeUserData("volume", 90);
        expect(getUserData("volume")).toBe(90);
    });

    test("returns null for keys that were never written", () => {
        expect(getUserData("themeMode")).toBeNull();
        expect(getUserData("windowSize")).toBeNull();
    });

    test("reads several keys at once", () => {
        writeUserData("volume", 12);
        writeUserData("folder", "F:\\Audio");
        expect(getUserDatas(["volume", "folder"])).toEqual({ volume: 12, folder: "F:\\Audio" });
    });

    test("writes several keys in one transaction", () => {
        writeUserDatas({ volume: 55, folder: "G:\\Tracks" });
        expect(getUserData("volume")).toBe(55);
        expect(getUserData("folder")).toBe("G:\\Tracks");
    });
});
