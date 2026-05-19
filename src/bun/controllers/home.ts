import { Artist } from "../../shared/types.ts";
import Player from "../music/index.ts";

interface Pin {
    source: string,
    type: string,
    id: string
}

export default async function HomeController(player: Player, pin: string[]) {
    const newPins: Pin[] = pin.map(item => {
        const [source, type, id] = item.split(":")
        return {
            source, type, id
        }
    })
    const artists = newPins.filter((item: Pin) => item.type.includes("artist"));
    const pinArtists = await Promise.all(artists.map((item: Pin) => player.youtube.fetch_artist(item.id, true)));

    const playlists = newPins.filter((item: Pin) => item.type.includes("playlist"));
    const pinPlaylists = await Promise.all(playlists.map((item: Pin) => player.youtube.fetch_playlist(item.id, true)));
    const tracks = newPins.filter((item: Pin) => item.type.includes("track"));

    const pinTracks = await player.youtube.fetch_track(tracks.map(item => item.id));

    const ytb_new_tracks = await player.youtube.get_new_tracks(pinArtists.map((item: Artist) => item.id))
    return { artists: pinArtists, playlists: pinPlaylists, newTracks: ytb_new_tracks, tracks: pinTracks }
}