export default async function fetch_data(url: string, mode: "GET" | "POST" = "GET", data?: any) {
    try {
        const response = await fetch(`http://localhost:3000${url}`, {
            method: mode,
            headers: {
                "Content-Type": "application/json",
            },
            body: typeof data === "object" ? JSON.stringify(data) : data
        })
        if (response.status === 500 || response.status === 404) {
            const result = await response.json();
            throw new Error(result.mesage)
        }
        if (response.status === 204) {
            return "ok"
        }
        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error(error)
    }
}