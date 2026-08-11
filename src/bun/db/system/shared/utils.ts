import type { System } from "../../../../shared/types.ts";

export function getSystemKeyType(key: keyof System): "number" | "string" | "boolean" | "json" {
    if (key === "appPort") return "number";
    if (key === "DiscordClientId") return "string";
    if (key === "isLocal" || key === "isDiscord") return "boolean";
    if (key === "googleClientId" || key === "googleClientSecret") return "string";
    return "json";
}

export function encodeSystemValue(key: keyof System, data: unknown): string {
    const t = getSystemKeyType(key);
    if (t === "number") return String(Number(data));
    if (t === "boolean") return data ? "1" : "0";
    if (t === "string") return String(data);
    return JSON.stringify(data);
}

export function decodeSystemValue(key: keyof System, value: string): unknown {
    const t = getSystemKeyType(key);
    if (t === "number") return Number(value);
    if (t === "boolean") return value === "1";
    if (t === "string") return value;
    return JSON.parse(value);
}
