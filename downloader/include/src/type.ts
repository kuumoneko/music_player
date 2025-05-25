
export interface Download_queue {
    link: string,
    title: string,
    mode: string,
    format: string,
    from: string
}
export enum Audio_format {
    aac = "aac",
    alac = "alac",
    flac = "flac",
    m4a = "m4a",
    mp3 = "mp3",
    opus = "opus",
    vorbis = "vorbis",
    wav = "wav"
}

export enum download_mode {
    video = "video",
    audio = "audio",
}

export interface Downloader_options {
    ytdlp?: string,
    spotdlp?: string,
    ffmpeg?: string,
    download_folder?: string,
    spot_errors?: string,
    audio_format?: Audio_format,
    youtube_api_key?: string,
    spotify_api_key?: string,
    spotify_client?: string
}