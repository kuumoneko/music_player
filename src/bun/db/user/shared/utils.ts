export enum KeyType {
    Number = "number",
    String = "string",
    Boolean = "boolean",
    JSON = "json"
}

export function getUserValueType(key: string): KeyType {
    if (['repeat', 'shuffle', 'volume'].includes(key)) return KeyType.Number;
    if (['QuitOnClose', 'closeToTray', 'isPlaying', 'isLoading'].includes(key)) return KeyType.Boolean;
    if (['folder'].includes(key)) return KeyType.String;
    return KeyType.JSON;
}

export function encodeValue(key: string, data: unknown): string {
    const t = getUserValueType(key);
    if (t === KeyType.Number) return String(Number(data));
    if (t === KeyType.Boolean) return data ? "1" : "0";
    if (t === KeyType.String) return String(data);
    return JSON.stringify(data);
}

export function decodeValue(key: string, value: string) {
    const t = getUserValueType(key);
    if (t === KeyType.Number) return Number(value);
    if (t === KeyType.Boolean) return value === "1";
    if (t === KeyType.String) return value;
    return JSON.parse(value);
}