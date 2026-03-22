import { Artist } from "@/shared/types.ts";
import Player from "../music/index.ts";

export default async function HomeController(player: Player, pin: any[]) {
    const artists = pin.filter((item: any) => item.type.includes("artist"));
    const playlists = pin.filter((item: any) => item.type.includes("playlist") || item.type.includes("album"));
    const tracks = pin.filter((item: any) => item.type.includes("track"));

    const ytb_new_tracks = await player.youtube.get_new_tracks(artists.filter((item: Artist) => item.source === "youtube").map((item: Artist) => item.id))
    // const spt_new_tracks = await player.spotify.get_new_tracks(artist.filter((item: Artist) => item.source === "spotify").map((item: Artist) => item.id))
    // const new_tracks = [...ytb_new_tracks, ...spt_new_tracks];

    return { artists, playlists, newTracks: ytb_new_tracks, tracks }
}