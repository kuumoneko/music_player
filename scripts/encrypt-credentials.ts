// Encrypts a credentials profile into data/system.json.
// Usage: bun ./scripts/encrypt-credentials.ts --profile <name>
// Profile file: apikeys/<name>.json  (e.g. apikeys/release.json, apikeys/myown.json)
// Shape:
//   {
//     "api_keys": ["AIza..."],
//     "google": { "client_id": "xxx.apps.googleusercontent.com", "client_secret": "..." }
//   }
// Discord file: apikeys/discord.json (required)
// Shape:
//   { "client_id": "abc123..." }
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encryptCredential } from "../src/bun/lib/crypto.ts";

const ROOT = import.meta.dir ? resolve(import.meta.dir, "..") : process.cwd();
const SYSTEM_FILE = resolve(ROOT, "data", "system.json");

interface ProfileFile {
    api_keys: string[];
    google: { client_id: string; client_secret: string };
}

interface DiscordFile {
    client_id?: string;
}

function readProfileArg(): string {
    const args = process.argv.slice(2);
    const idx = args.indexOf("--profile");
    if (idx === -1 || !args[idx + 1]) {
        console.error("Missing required --profile <name> argument.");
        console.error("Usage: bun ./scripts/encrypt-credentials.ts --profile release|myown");
        process.exit(1);
    }
    const profile = args[idx + 1];
    if (!/^[a-zA-Z0-9_-]+$/.test(profile)) {
        console.error(`Invalid profile name: ${profile}`);
        process.exit(1);
    }
    return profile;
}

function looksLikePlaceholder(value: string): boolean {
    return /^(abcxyz|123abc|your[-_ ]?[a-z]+)$/i.test(value) || value.length < 10;
}

async function main() {
    const profile = readProfileArg();
    const profileFile = resolve(ROOT, "apikeys", `${profile}.json`);
    if (!existsSync(profileFile)) {
        console.error(`Profile file not found: ${profileFile}`);
        console.error("Create it with { \"api_keys\": [...], \"google\": { \"client_id\": \"...\" } } and try again.");
        process.exit(1);
    }

    let data: ProfileFile;
    try {
        data = JSON.parse(readFileSync(profileFile, "utf8")) as ProfileFile;
    } catch (e) {
        console.error(`Failed to parse ${profileFile}: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
    }

    const keys = Array.isArray(data.api_keys) ? data.api_keys.filter(k => typeof k === "string" && k.trim().length > 0) : [];
    if (keys.length === 0) {
        console.error(`No api_keys found in ${profileFile}.`);
        process.exit(1);
    }
    for (const k of keys) {
        if (looksLikePlaceholder(k.trim())) {
            console.warn(`  ! suspicious placeholder key in profile: "${k.trim()}"`);
        }
    }
    const clientId = data.google.client_id.trim();
    const clientSecret = data.google.client_secret.trim();
    if (!clientId) {
        console.error(`No client_id found in google section of ${profileFile}.`);
        process.exit(1);
    }
    if (!clientSecret) {
        console.error(`No client_secret found in google section of ${profileFile}.`);
        process.exit(1);
    }

    const discordFile = resolve(ROOT, "apikeys", "discord.json");
    if (!existsSync(discordFile)) {
        console.error(`Discord file not found: ${discordFile}`);
        console.error('Create it with { "client_id": "..." } and try again.');
        process.exit(1);
    }

    let discordClientId: string;
    try {
        const discordData = JSON.parse(readFileSync(discordFile, "utf8")) as DiscordFile;
        discordClientId = discordData.client_id?.trim() || "";
    } catch (e) {
        console.error(`Failed to parse ${discordFile}: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
    }
    if (!discordClientId) {
        console.error(`No client_id found in ${discordFile}.`);
        process.exit(1);
    }

    const existing = existsSync(SYSTEM_FILE) ? JSON.parse(readFileSync(SYSTEM_FILE, "utf8")) : {};

    const encryptedKeys = [];
    for (const k of keys) encryptedKeys.push(await encryptCredential(k.trim()));
    existing.youtubeApiKeys = encryptedKeys;
    existing.googleClientId = clientId;
    existing.googleClientSecret = await encryptCredential(clientSecret);

    // Ensure runtime/system keys are always present so dev and packaged runs
    // get local mode and Discord RPC.
    // Fill-if-missing only: explicit values in the file always survive.
    const SYSTEM_DEFAULTS: Record<string, unknown> = {
        isLocal: true,
        isDiscord: true,
        appPort: 12345,
        DiscordClientId: discordClientId,
    };
    for (const [k, v] of Object.entries(SYSTEM_DEFAULTS)) {
        if (!(k in existing)) existing[k] = v;
    }

    writeFileSync(SYSTEM_FILE, JSON.stringify(existing, null, 2), "utf8");
    console.log(`Wrote ${SYSTEM_FILE} (profile: ${profile})`);
    console.log(`  youtubeApiKeys: ${encryptedKeys.length} encrypted key(s)`);
    console.log(`  googleClientId: ${existing.googleClientId ?? "(none)"}`);
    console.log(`  googleClientSecret: ${existing.googleClientSecret ? "encrypted" : "(none)"}`);
    console.log(`  discordClientId: ${discordClientId}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
