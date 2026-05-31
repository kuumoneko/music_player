export default function formatArtists(artists: { name: string, id: string }[]) {
    if (artists === undefined || artists === null || artists.length === 0) return "";
    return artists.map(artist => artist.name).join(", ");
}
