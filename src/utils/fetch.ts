
export default async function fetch_data(url: string, mode: "GET" | "POST" = "GET", data?: any): Promise<any> {
    try {
        try {
            const result = await window.electronAPI.api(mode, {
                url: url,
                data: data
            });
            if (!result.ok) throw new Error(result.data);
            return result.data;
        } catch (error) {
            console.error('Error communicating with Electron:', error);
        }

    } catch (error) {
        console.error(error)
    }
}