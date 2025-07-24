import { Downloader_options, Download_queue, download_mode } from './music/types.ts';

export default class Downloader {
    constructor(options: Downloader_options)

    get_download_folder(): void

    get_audio_format(): void

    get_ytdlp(): void

    get_spotdlp(): void

    get_ffmpeg(): void

    format_title(str: string): string

    fetchPlaylistVideos(id: string, pagetoken: string): Promise<any>

    fetchVideos(id: string): Promise<any>

    fetchPlaylistVideos_spotify(id: string): Promise<any>

    fetchTrackVideos_spotify(id: string): Promise<any>

    fetchAlbumVideos_spotify(id: string): Promise<any>

    get_all_videos_from_playlist(id: string): Promise<void>

    search_youtube_video(search: string): Promise<any>

    get_all_videos_from_playlist_spotify(id: string): Promise<void>

    get_all_videos_from_album_spotify(id: string): Promise<void>

    add_link(link: string): void


    add_to_queue(options: {
        mode: download_mode,
        link: string | string[]
    }): Promise<void>

    download_Youtube_mp3(video: Download_queue): Promise<string>

    download_Spotify_mp3(video: Download_queue): Promise<string>

    download(): Promise<void>

    check_env(): Promise<void>
}