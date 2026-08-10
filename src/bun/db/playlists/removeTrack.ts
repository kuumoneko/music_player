import db from "../setup.ts"

const deleteStmt = db.prepare(`
  DELETE FROM playlist_tracks
  WHERE playlist_id = $playlist_id AND track_id = $track_id
`);

export default function removeTrackFromPlaylist(playlistId: string, trackId: string): void {
    deleteStmt.run({ $playlist_id: playlistId, $track_id: trackId });
}
