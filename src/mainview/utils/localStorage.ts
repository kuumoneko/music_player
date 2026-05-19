export default function localstorage(mode: "get" | "set", key: string, defaultValue?: string | number | boolean | object): string | number | boolean | object | null | void {
    if (mode === "get") {
        const value = localStorage.getItem(key);
        if (typeof defaultValue === "string" || typeof defaultValue === "number") {
            if (typeof defaultValue === "string") {
                return value != null ? String(value) : defaultValue
            }
            else {
                return value != null ? Number(value) : defaultValue
            }
        }
        else if (typeof defaultValue === "boolean") {
            if (value)
                return value === "true" ? true : false;
            else
                return defaultValue;
        }
        else {
            return JSON.parse(value ?? JSON.stringify(defaultValue));
        }
    }
    else if (mode === "set") {
        localStorage.setItem(key, typeof defaultValue === "string" ? defaultValue : JSON.stringify(defaultValue));
    }
}