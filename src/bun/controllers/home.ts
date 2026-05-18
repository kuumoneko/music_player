import Player from "../music/index.ts";

export default async function HomeController(player: Player, pin: string[]) {
    const newPins: any[] = pin.map(item => {
        const [source, type, id] = item.split(":")
        return {
            source, type, id
        }
    })
    const artists = newPins.filter((item: any) => item.type.includes("artist"));
    const pinArtists = await Promise.all(artists.map((item: any) => player.youtube.fetch_artist(item.id)));
    const playlists = newPins.filter((item: any) => item.type.includes("playlist"));
    const pinPlaylists = await Promise.all(playlists.map((item: any) => player.youtube.fetch_playlist(item.id)));
    const tracks = newPins.filter((item: any) => item.type.includes("track"));

    const pinTracks = await player.youtube.fetch_track(tracks.map(item => item.id));

    const ytb_new_tracks = await player.youtube.get_new_tracks(artists.filter((item: any) => item.source === "youtube").map((item: any) => item.id))

    return { artists: pinArtists, playlists: pinPlaylists, newTracks: ytb_new_tracks, tracks: pinTracks }
}