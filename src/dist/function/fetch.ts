export async function get(url: string) {
    const res = await fetch(`http://localhost:3001${url}`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json', },
    })

    const data = await res.json();

    if (res.status !== 200 && res.status !== 202) {
        console.error(data.message)
    }

    return data;
}

export async function post(url: string, body: any) {
    const res = await fetch(`http://localhost:3001${url}`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(body)
    })

    const data = await res.json();

    if (res.status !== 200) {
        console.error(data.message)
    }

    return data;
}

export async function get_download() {
    const res = await fetch('http://localhost:3001/download', {
        method: "GET",
        headers: { 'Content-Type': 'application/json' },
    });


    if (res.status === 200) {
        return await res.blob();
    }
    else {
        const data = await res.json();
        console.error(data.message)
    }
}