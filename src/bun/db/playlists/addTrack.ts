import db from "../setup.ts"
import type { Track } from "../../../shared/types.ts";
import writeTracks from "../tracks/write.ts";

const insertTrackStmt = db.prepare(`
  INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, addedAt)
  SELECT $playlist_id, $track_id, datetime('now')
  WHERE NOT EXISTS (SELECT 1 FROM playlist_tracks WHERE playlist_id = $playlist_id AND track_id = $track_id)
`);

export default function addTrackToPlaylist(playlistId: string, track: Track): void {
    writeTracks([track]);
    insertTrackStmt.run({ $playlist_id: playlistId, $track_id: track.id });
}
