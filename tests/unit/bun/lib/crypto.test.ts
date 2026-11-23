import { describe, expect, test } from "bun:test";
import { decryptCredential, encryptCredential, isEncrypted } from "../../../../src/bun/lib/crypto.ts";

describe("isEncrypted", () => {
    test("detects the ENC: prefix", () => {
        expect(isEncrypted("ENC:abc:def")).toBe(true);
    });

    test("rejects plaintext and empty payloads", () => {
        expect(isEncrypted("plain-value")).toBe(false);
        expect(isEncrypted("")).toBe(false);
        expect(isEncrypted("enc:lowercase")).toBe(false);
    });
});

describe("encryptCredential / decryptCredential", () => {
    test("round-trips a plaintext credential", async () => {
        const payload = await encryptCredential("my-secret-api-key");
        expect(payload.startsWith("ENC:")).toBe(true);
        expect(isEncrypted(payload)).toBe(true);
        expect(await decryptCredential(payload)).toBe("my-secret-api-key");
    });

    test("round-trips unicode and long values", async () => {
        const value = `pässwörd-日本語-${"x".repeat(500)}`;
        const payload = await encryptCredential(value);
        expect(await decryptCredential(payload)).toBe(value);
    });

    test("uses a fresh IV for every encryption", async () => {
        const [first, second] = await Promise.all([
            encryptCredential("same"),
            encryptCredential("same"),
        ]);
        expect(first).not.toBe(second);
        expect(await decryptCredential(first)).toBe("same");
        expect(await decryptCredential(second)).toBe("same");
    });

    test("returns null for unencrypted input", async () => {
        expect(await decryptCredential("plain-text")).toBeNull();
        expect(await decryptCredential("")).toBeNull();
    });

    test("returns null for malformed payloads", async () => {
        expect(await decryptCredential("ENC:no-separator")).toBeNull();
        expect(await decryptCredential("ENC::")).toBeNull();
        expect(await decryptCredential("ENC:AAAA:BBBB")).toBeNull();
    });

    test("returns null when the ciphertext was tampered with", async () => {
        const payload = await encryptCredential("tamper-me");
        const separator = payload.indexOf(":", "ENC:".length);
        const iv = payload.slice("ENC:".length, separator);
        const body = payload.slice(separator + 1);
        const flipped = body.slice(0, -2) + (body.endsWith("AA") ? "BB" : "AA");
        expect(await decryptCredential(`ENC:${iv}:${flipped}`)).toBeNull();
    });
});
