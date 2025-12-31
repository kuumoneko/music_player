import { Artist } from "../types/index.ts";
import Player from "../music/index.ts";

export default async function HomeController(player: Player, pin: any[]) {
    const artist = pin.filter((item: any) => item.mode.includes("artist"));
    const playlist = pin.filter((item: any) => item.mode.includes("playlist") || item.mode.includes("album"));

    const ytb_new_tracks = await player.youtube.get_new_tracks(artist.filter((item: Artist) => item.source === "youtube").map((item: Artist) => item.id))
    const spt_new_tracks = await player.spotify.get_new_tracks(artist.filter((item: Artist) => item.source === "spotify").map((item: Artist) => item.id))
    const new_tracks = [...ytb_new_tracks, ...spt_new_tracks];
    return {
        artist: artist,
        playlist: playlist,
        new_tracks: new_tracks
    }
}