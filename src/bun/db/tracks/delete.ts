import db from "../setup.ts"

const deleteStmt = db.prepare("DELETE FROM tracks WHERE id = ?");
const deleteArtistsStmt = db.prepare(`DELETE FROM track_artists WHERE track_id = ?;`);

const deleteTrack = (id: string) => {
    deleteStmt.run(id);
    deleteArtistsStmt.run(id);
}

const deleteTracks = db.transaction((ids) => {
    for (const id of ids) {
        if (id === undefined || id === null) continue;
        deleteTrack(id);
    }
})

export default deleteTracks;