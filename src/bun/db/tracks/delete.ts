import db from "../setup.ts"

const deleteStmt = db.prepare("DELETE FROM tracks WHERE id = ?");
const deleteArtistStmt = db.prepare("DELETE FROM track_artists WHERE track_id = ?");

const deleteTrack = (id: string) => {
    deleteArtistStmt.run(id);
    deleteStmt.run(id);
}

const deleteTracks = db.transaction((ids) => {
    for (const id of ids) {
        if (id === undefined || id === null) continue;
        deleteTrack(id);
    }
})

export function deleteStaleTrackArtists(artistId: string, validTrackIds: string[]) {
    if (validTrackIds.length === 0) {
        // No valid tracks — remove all links for this artist
        db.prepare("DELETE FROM track_artists WHERE artist_id = ?").run(artistId);
        return;
    }
    const placeholders = validTrackIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM track_artists WHERE artist_id = ? AND track_id NOT IN (${placeholders})`).run(artistId, ...validTrackIds);
}

export default deleteTracks;