import { Artist } from "@/shared/types.ts";
import Player from "../music/index.ts";

export default async function HomeController(player: Player, pin: string[]) {
    const newPins: any[] = pin.map(item => {
        const [source, type, id] = item.split(":")
        return {
            source, type, id
        }
    })
    const artists = newPins.filter((item: any) => item.type.includes("artist"));
    const pinArtists = [];
    for (const item of artists) {
        pinArtists.push(await player.youtube.fetch_artist(item.id))
    }
    const playlists = newPins.filter((item: any) => item.type.includes("playlist"));
    const pinPlaylists = [];
    for (const item of playlists) {
        pinPlaylists.push(await player.youtube.fetch_playlist(item.id))
    }
    const tracks = newPins.filter((item: any) => item.type.includes("track"));

    const pinTracks = await player.youtube.fetch_track(tracks.map(item => item.id));

    const ytb_new_tracks = await player.youtube.get_new_tracks(artists.filter((item: Artist) => item.source === "youtube").map((item: Artist) => item.id))

    return { artists: pinArtists, playlists: pinPlaylists, newTracks: ytb_new_tracks, tracks: pinTracks }
}