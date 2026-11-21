import db from "../setup.ts"
import type { Playlist } from "../../../shared/types.ts";
import writeTracks from "../tracks/write.ts";
import writeLogs from "../log/write.ts";

const upsertPlaylistStmt = db.prepare(`
  INSERT INTO playlists (id, name, source, thumbnail, duration, lastFetched, etag)
  VALUES ($id, $name, $source, $thumbnail, $duration, $lastFetched, $etag)
  ON CONFLICT(id) DO UPDATE SET 
    name = excluded.name,
    thumbnail = excluded.thumbnail,
    duration = excluded.duration,
    lastFetched = excluded.lastFetched,
    etag = COALESCE(excluded.etag, playlists.etag);
`);

const clearPlaylistTracksStmt = db.prepare(`DELETE FROM playlist_tracks WHERE playlist_id = ?;`);
const markPlaylistMissingStmt = db.prepare(`UPDATE playlists SET missingSince = $now WHERE id = $id;`);
const clearPlaylistMissingStmt = db.prepare(`UPDATE playlists SET missingSince = NULL WHERE id = $id;`);

// YouTube playlist ids always start with one of these prefixes. Channel ids
// (UC...), video ids and radio mixes were ending up here as bogus "playlists"
// and could only ever 404 on refresh.
const YOUTUBE_PLAYLIST_ID = /^(PL|UU|OL|VL)[A-Za-z0-9_-]+$/;
const skippedPlaylistIds = new Set<string>();

const deleteInvalidPlaylistsStmt = db.prepare(`
  DELETE FROM playlists
  WHERE source = 'youtube'
    AND id NOT LIKE 'PL%'
    AND id NOT LIKE 'UU%'
    AND id NOT LIKE 'OL%'
    AND id NOT LIKE 'VL%'
    AND NOT EXISTS (SELECT 1 FROM playlist_tracks pt WHERE pt.playlist_id = playlists.id);
`);

/** Drops playlist rows whose id can never be fetched, but only when empty. */
export function deleteInvalidPlaylists(): number {
    try {
        return deleteInvalidPlaylistsStmt.run().changes;
    } catch {
        return 0;
    }
}

/** Remembers that YouTube refuses this playlist, so it is not retried every start. */
export function markPlaylistMissing(id: string): void {
    markPlaylistMissingStmt.run({ $id: id, $now: Date.now() });
}

export function clearPlaylistMissing(id: string): void {
    clearPlaylistMissingStmt.run({ $id: id });
}

const insertPlaylistTrackStmt = db.prepare(`
  INSERT INTO playlist_tracks (playlist_id, track_id, addedAt) 
  SELECT ?, id, ? FROM tracks WHERE id = ?;
`);

const writePlaylist = db.transaction((playlist: Playlist) => {
    if (playlist.source === "youtube" && !YOUTUBE_PLAYLIST_ID.test(playlist.id)) {
        if (!skippedPlaylistIds.has(playlist.id)) {
            skippedPlaylistIds.add(playlist.id);
            writeLogs([{ type: "info", message: `Skipped playlist "${playlist.id}": not a playlist id` }]);
        }
        return;
    }

    if (playlist.tracks && playlist.tracks.length > 0) {
        writeTracks(playlist.tracks);
    }

    upsertPlaylistStmt.run({
        $id: playlist.id,
        $name: playlist.name,
        $source: playlist.source,
        $thumbnail: playlist.thumbnail,
        $duration: playlist.duration || 0,
        $lastFetched: Date.now(),
        $etag: playlist.etag ?? null
    });

    try {
        if (playlist.tracks !== undefined || playlist.ids !== undefined) {
            const trackIdsToSave = playlist.tracks
                ? playlist.tracks.map(t => t.id)
                : (playlist.ids || []);
            clearPlaylistTracksStmt.run(playlist.id);
            for (let i = 0; i < trackIdsToSave.length; i++) {
                insertPlaylistTrackStmt.run(playlist.id, playlist.addedAt?.[i] ?? null, trackIdsToSave[i]);
            }
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        writeLogs([{ type: "error", message }]);
    }
});

export default writePlaylist