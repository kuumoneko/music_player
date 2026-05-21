export default function formatArtists(artists: { name: string, id: string }[]) {
    return artists.map(artist => artist.name).join(", ");
}