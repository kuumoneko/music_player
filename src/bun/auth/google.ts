import { getSystemData, getUserData, writeSystemData, writeUserData, writeLogs } from "../db/index.ts";
import { encryptCredential, decryptCredential, isEncrypted } from "../lib/crypto.ts";
import type { GoogleTokens } from "../../shared/types.ts";

const YT_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const YT_TOKEN_BASE = "https://oauth2.googleapis.com/token";
const SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "openid",
    "email",
    "profile",
];

const PKCE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

function randomString(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let out = "";
    for (let i = 0; i < length; i++) out += PKCE_ALPHABET[bytes[i] % PKCE_ALPHABET.length];
    return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return base64UrlEncode(new Uint8Array(bytes));
}

export class GoogleAuth {
    private clientId: string = "";
    private clientSecret: string = "";
    private tokens: GoogleTokens | null = null;
    private pendingVerifier: string | null = null;

    async loadCredentials() {
        const { googleClientId, googleClientSecret } = getSystemData();
        this.clientId = googleClientId ?? "";
        const storedSecret = googleClientSecret as string | undefined;
        this.clientSecret = storedSecret && isEncrypted(storedSecret)
            ? (await decryptCredential(storedSecret)) ?? ""
            : storedSecret ?? "";
    }

    async loadTokens() {
        const stored = getUserData("googleOAuthTokens") as GoogleTokens | null | undefined;
        if (!stored) {
            this.tokens = null;
            return;
        }
        if (typeof stored === "string" && isEncrypted(stored)) {
            const plain = await decryptCredential(stored);
            if (plain) {
                try {
                    this.tokens = JSON.parse(plain) as GoogleTokens;
                } catch {
                    this.tokens = null;
                }
            } else {
                this.tokens = null;
            }
        } else {
            this.tokens = stored;
        }
    }

    get hasCredentials(): boolean {
        return !!this.clientId;
    }

    get hasTokens(): boolean {
        return !!this.tokens?.access_token;
    }

    get hasValidToken(): boolean {
        return this.hasTokens && (this.tokens!.expiry_date > Date.now() + 300_000);
    }

    get authState() {
        return {
            isSignedIn: this.hasValidToken,
            hasOAuth: this.hasCredentials,
            email: getUserData("googleUserEmail") as string | undefined,
            expiresAt: this.tokens?.expiry_date,
        };
    }

    getAccessToken(): string | null {
        return this.tokens?.access_token ?? null;
    }

    async init() {
        await this.loadCredentials();
        await this.loadTokens();
        if (this.tokens && !this.hasValidToken) {
            await this.tryRefresh();
        }
    }

    async getAuthUrl(port: number): Promise<string> {
        const redirectUri = `http://localhost:${port}/`;
        this.pendingVerifier = randomString(64);
        const challenge = await sha256Base64Url(this.pendingVerifier);
        const url = new URL(YT_OAUTH_BASE);
        url.searchParams.set("client_id", this.clientId);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", SCOPES.join(" "));
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
        url.searchParams.set("code_challenge", challenge);
        url.searchParams.set("code_challenge_method", "S256");
        return url.toString();
    }

    async exchangeCode(code: string, port: number): Promise<boolean> {
        const redirectUri = `http://localhost:${port}/`;
        try {
            const body = new URLSearchParams({
                code,
                client_id: this.clientId,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            });
            if (this.clientSecret) body.set("client_secret", this.clientSecret);
            if (this.pendingVerifier) {
                body.set("code_verifier", this.pendingVerifier);
                this.pendingVerifier = null;
            }
            const res = await fetch(YT_TOKEN_BASE, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });
            const data = await res.json();
            if (!res.ok) {
                writeLogs([{ type: "error", message: `Google OAuth token exchange failed: ${data.error_description ?? data.error ?? res.status}` }]);
                return false;
            }
            this.tokens = {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expiry_date: Date.now() + (data.expires_in * 1000),
                scope: data.scope,
                token_type: data.token_type,
            };
            this.persistTokens();
            await this.fetchAndStoreEmail();
            return true;
        } catch (e) {
            writeLogs([{ type: "error", message: `Google OAuth exchange error: ${e}` }]);
            return false;
        }
    }

    async tryRefresh(): Promise<boolean> {
        if (!this.tokens?.refresh_token || !this.clientId) return false;
        try {
            const body = new URLSearchParams({
                client_id: this.clientId,
                refresh_token: this.tokens.refresh_token,
                grant_type: "refresh_token",
            });
            if (this.clientSecret) body.set("client_secret", this.clientSecret);
            const res = await fetch(YT_TOKEN_BASE, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });
            const data = await res.json();
            if (!res.ok) {
                writeLogs([{ type: "error", message: `Google OAuth refresh failed: ${data.error_description ?? data.error ?? res.status}` }]);
                return false;
            }
            this.tokens.access_token = data.access_token;
            this.tokens.expiry_date = Date.now() + (data.expires_in * 1000);
            if (data.scope) this.tokens.scope = data.scope;
            this.persistTokens();
            return true;
        } catch (e) {
            writeLogs([{ type: "error", message: `Google OAuth refresh error: ${e}` }]);
            return false;
        }
    }

    signOut() {
        this.tokens = null;
        writeUserData("googleOAuthTokens", null as any);
        writeUserData("googleUserEmail", null as any);
    }

    async saveCredentials(clientId: string, clientSecret: string = "") {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        writeSystemData({
            googleClientId: clientId,
            googleClientSecret: clientSecret ? await encryptCredential(clientSecret) : undefined,
        });
    }

    clearCredentials() {
        this.clientId = "";
        this.clientSecret = "";
        this.tokens = null;
        writeSystemData({ googleClientId: "", googleClientSecret: "" });
        writeUserData("googleOAuthTokens", null as any);
        writeUserData("googleUserEmail", null as any);
    }

    private async fetchAndStoreEmail() {
        if (!this.tokens?.access_token) return;
        try {
            const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${this.tokens.access_token}` },
            });
            if (res.ok) {
                const data = await res.json();
                writeUserData("googleUserEmail", data.email as string);
            }
        } catch {
            // ignore — email is optional
        }
    }

    private async persistTokens() {
        writeUserData("googleOAuthTokens", this.tokens ? await encryptCredential(JSON.stringify(this.tokens)) : null as any);
    }
}
