

enum EndPoints {
    Mine = "mine",
    RefreshToken = "refresh_token",
    UserPlaylists = "userplaylists",
    UserArtists = "userartists",
    UserTracks = "usertracks",
    Playlists = "playlists"
}

const endpoints: { [key: string]: { url: string, params: any } } = {
    "mine": {
        "url": "https://youtube.googleapis.com/youtube/v3/channels",
        "params": {
            "part": "snippet",
            "fields": "etag,items(id,snippet(title,thumbnails.default.url))",
            mine: "true"
        }
    },
    "refresh_token": {
        "url": "https://oauth2.googleapis.com/token",
        "params": {
            "grant_type": "refresh_token",
        }
    },
    "userplaylists": {
        url: "https://youtube.googleapis.com/youtube/v3/playlists",
        params: {
            part: "snippet%2CcontentDetails",
            fields: "etag,nextPageToken,items(id,snippet(title,thumbnails.default.url))",
            mine: "true",
            maxResults: "50"
        }
    },
    usertracks: {
        url: "https://youtube.googleapis.com/youtube/v3/videos",
        params: {
            part: "snippet",
            fields: "etag,nextPageToken,items(id)",
            mime: "true",
            maxResults: "50"
        }
    },
    userartists: {
        url: "https://youtube.googleapis.com/youtube/v3/subscriptions",
        params: {
            part: "snippet",
            fields: "etag,nextPageToken,items(snippet.resourceId.channelId)",
            mine: "true",
            maxResults: "50"
        }
    },
    playlists: {
        url: "https://youtube.googleapis.com/youtube/v3/playlists",
        params: {
            part: "snippet",
            fields: "etag,items.snippet.title",
            mine: "true",
            maxResults: "50"
        }
    },
    "playlist_item": {
        "url": "https://youtube.googleapis.com/youtube/v3/playlistItems",
        "params": {
            "part": "snippet",
            "fields": "etag,nextPageToken,items(snippet.resourceId.videoId)"
        }
    },
}

export default class User {
    private accessToken: {
        token: any;
        expires: number;
    };
    private refreshToken: {
        token: any;
        expires: number;
    };
    private client: {
        id: string,
        secret: string, key: string
    };
    private tokenType: any;
    private user: {
        username: string,
        thumbnail: string, etag: string
    }

    constructor(options: {
        accessToken: {
            token: any;
            expires: number;
        };
        refreshToken: {
            token: any;
            expires: number;
        };
        tokenType: any;
        client: {
            id: string,
            secret: string, key: string
        }
    }
    ) {
        this.accessToken = options.accessToken;
        this.refreshToken = options.refreshToken;
        this.tokenType = options.tokenType;
        this.client = options.client;
    }

    create_end_point(endpoint: { url: string, params: any }) {
        let url = endpoint.url + "?" + new URLSearchParams(endpoint.params).toString() + "&key=" + this.client.key;
        return url;
    }

    getToken() {
        return {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            tokenType: this.tokenType
        }
    }

    checkExpires(key: string) {
        const now = new Date().getTime();
        if (now > this[key].expires) {
            return false;
        }
        return true;
    }

    async fetch(id: EndPoints | string, etag?: string) {
        if (this.checkExpires("accessToken")) {
            await this.refreshAccessToken();
        }
        let url = id;
        if (typeof id !== "string") {
            url = `${this.create_end_point(endpoints[id])}`;
        }
        // let done = false;
        let data: any;
        let header: any = {
            'Content-Type': 'application/json',
            "Authorization": `${this.tokenType} ${this.accessToken.token}`,
        };
        if (etag && etag.length > 0) {
            header["If-None-Match"] = etag
        }
        const response = await fetch(`${url}&key=${this.client.key}`, {
            method: "GET",
            headers: header
        })

        if (response.status === 304 && response.statusText === "Not Modified") {
            return null
        }
        else if (response.status === 200) {
            data = await response.json();
            if (data.length === 0) {
                data = null;
            } else {

                if (data.error && data.error.errors[0].reason === "quotaExceeded") {
                    throw new Error("Reach quota of apikey")
                }
                else if (data.error === null || data.error === undefined) {
                    return data;
                }
                else {
                    throw new Error(data.error)
                }
            }
        }
        else {
            throw new Error(response.statusText)
        }
    }

    async refreshAccessToken() {
        if (this.checkExpires("refreshToken")) {
            return null;
        }
        const response = await fetch(endpoints[EndPoints.RefreshToken].url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                "client_id": this.client.id,
                "client_secret": this.client.secret,
                "refresh_token": this.refreshToken.token,
                "grant_type": "refresh_token"
            })
        });
        const data = await response.json();
        if (response.ok) {
            this.accessToken = {
                token: data.access_token,
                expires: new Date().getTime() + data.expires_in * 1000
            };
            return this.accessToken;
        }
        return null;
    }

    async getUser(): Promise<{
        username: string,
        thumbnail: string
    }> {
        if (this.checkExpires("refreshToken")) {
            return null;
        }
        const data = await this.fetch(EndPoints.Mine, this.user.etag);

        if (data === null) {
            return {
                username: this.user?.username ?? "",
                thumbnail: this.user?.thumbnail ?? ""
            }
        }
        this.user = {
            username: data.items[0].snippet.title,
            thumbnail: data.items[0].snippet.thumbnails.default.url,
            etag: data.etag
        }
        return {
            username: data.items[0].snippet.title,
            thumbnail: data.items[0].snippet.thumbnails.default.url
        };
    }

    async getUserPlaylists(playlists: string) {
        if (this.checkExpires("refreshToken")) {
            return null;
        }
        const [etag, ...userplaylists] = playlists.split(",");

        const data = await this.fetch(EndPoints.UserPlaylists, etag);
        if (data === null) {
            return userplaylists;
        }

        return data;
    }

    async getUserArtists(artists: string) {
        if (this.checkExpires("refreshToken")) {
            return null;
        }
        const [etag, ...userartists] = artists.split(",");
        const data = await this.fetch(EndPoints.UserArtists, etag);
        if (data === null) {
            return userartists;
        }
        return data;
    }

    getlikedTracks(tracks: string) {
        return new Promise(async (resolve) => {
            if (this.checkExpires("refreshToken")) {
                return null;
            }

            const [etag, ...usertracks] = tracks.split(",");
            const data = await this.fetch(EndPoints.UserTracks, etag);
            if (data === null) {
                return usertracks;
            }
            resolve(data);
            if (data.nextPageToken && data.nextPageToken.length > 0) {
                let nextPageToken = data.nextPageToken;
                while (nextPageToken.length > 0) {
                    const nextData = await this.fetch(EndPoints.UserTracks, etag);
                    if (nextData === null) {
                        return usertracks;
                    }
                    nextPageToken = nextData.nextPageToken;
                    data.items.push(...nextData.items);
                    resolve(data);
                }
            }
        })
    }
}