export function parse_body(body: any) {
    if (typeof body === "string") {
        let data = "";
        try {
            data = JSON.parse(body)
        } catch {
            data = body;
        }
        return data;
    }
    else {
        return body;
    }
}