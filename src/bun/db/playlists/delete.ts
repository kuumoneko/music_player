import db from "../setup.ts"

const deleteStmt = db.prepare(`DELETE FROM playlists WHERE id = ?`);

export default function deletePlaylist(id: string): void {
    deleteStmt.run(id);
}
