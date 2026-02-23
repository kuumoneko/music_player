export function stringify(data: any) {
    const result = {
        e: data.etag,
        n: data.name,
        i: data.id,
        s: data.source,
        t: data.thumbnail,
        d: data.duration,
        r: data.releaseDate,
        a: data.artists,
        m: data.matched,
        tk: data.tracks,
        is: data.ids, pi: data.playlistId, p: data.path
    }
    Object.keys(result).forEach(key => {
        if (result[key as keyof typeof result] === undefined || result[key as keyof typeof result] === null) {
            delete result[key as keyof typeof result];
        }
    });
    return JSON.stringify(result);
}

export function parse(data: string) {
    const parsedData = JSON.parse(data);
    const result = {
        etag: parsedData.e,
        name: parsedData.n,
        id: parsedData.i,
        source: parsedData.s,
        thumbnail: parsedData.t,
        duration: parsedData.d,
        releaseDate: parsedData.r,
        artists: parsedData.a,
        matched: parsedData.m,
        tracks: parsedData.tk,
        ids: parsedData.is,
        playlistId: parsedData.pi,
        path: parsedData.p
    }
    Object.keys(result).forEach(key => {
        if (result[key as keyof typeof result] === undefined || result[key as keyof typeof result] === null) {
            delete result[key as keyof typeof result];
        }
    });
    return result;
}