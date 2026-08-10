export interface Thumbnail {
    url: string;
    width: number;
    height: number;
}

export interface InnerPlaylistItem {
    id: string;
    title: string;
    artist: string;
    channelId: string | null;
    duration: number;
    position: number;
    thumbnails: Thumbnail[];
    releasedDate?: string;
}

export interface InnerSearchItem {
    type: "video" | "playlist" | "channel";
    id: string;
    title: string;
    artist?: string;
    name?: string;
    thumbnails: Thumbnail[];
    duration?: number;
}

export interface InnerSearchResult {
    query: string;
    type: string;
    items: InnerSearchItem[];
    estimatedResults: number;
}
