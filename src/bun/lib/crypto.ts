// AES-256-GCM helpers for shipping credentials inside data/system.json.
// The key is derived from a fixed secret embedded in the bundle — this is
// obfuscation, not real security (anyone can extract the secret from backend.js).

const CREDENTIAL_SECRET = "kuumoapp::ship-credentials::v1";
const ENC_PREFIX = "ENC:";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function deriveKey(): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(CREDENTIAL_SECRET));
    return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function isEncrypted(payload: string): boolean {
    return typeof payload === "string" && payload.startsWith(ENC_PREFIX);
}

export async function encryptCredential(plaintext: string): Promise<string> {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
    return `${ENC_PREFIX}${base64UrlEncode(iv)}:${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

export async function decryptCredential(payload: string): Promise<string | null> {
    if (!isEncrypted(payload)) return null;
    const sep = payload.indexOf(":", ENC_PREFIX.length);
    if (sep === -1) return null;
    try {
        const key = await deriveKey();
        const iv = base64UrlDecode(payload.slice(ENC_PREFIX.length, sep));
        const data = base64UrlDecode(payload.slice(sep + 1));
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        return decoder.decode(plain);
    } catch {
        return null;
    }
}
