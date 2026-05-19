import db from "../setup.ts"
import type { Playlist } from "../../../shared/types.ts";
import writeTracks from "../tracks/write.ts";

const upsertPlaylistStmt = db.prepare(`
  INSERT INTO playlists (id, name, source, thumbnail, duration)
  VALUES ($id, $name, $source, $thumbnail, $duration)
  ON CONFLICT(id) DO UPDATE SET 
    name = excluded.name,
    thumbnail = excluded.thumbnail,
    duration = excluded.duration;
`);

const clearPlaylistTracksStmt = db.prepare(`DELETE FROM playlist_tracks WHERE playlist_id = ?;`);

const insertPlaylistTrackStmt = db.prepare(`
  INSERT INTO playlist_tracks (playlist_id, track_id) 
  SELECT ?, id FROM tracks WHERE id = ?;
`);

const writePlaylist = db.transaction((playlist: Playlist) => {
    if (playlist.tracks && playlist.tracks.length > 0) {
        writeTracks(playlist.tracks);
    }

    upsertPlaylistStmt.run({
        $id: playlist.id,
        $name: playlist.name,
        $source: playlist.source,
        $thumbnail: playlist.thumbnail,
        $duration: playlist.duration || 0
    });

    try {
        if (playlist.tracks !== undefined || playlist.ids !== undefined) {
            const trackIdsToSave = playlist.tracks
                ? playlist.tracks.map(t => t.id)
                : (playlist.ids || []);
            clearPlaylistTracksStmt.run(playlist.id);
            for (const trackId of trackIdsToSave) {
                insertPlaylistTrackStmt.run(playlist.id, trackId);
            }
        }
    } catch { }
});

export default writePlaylist