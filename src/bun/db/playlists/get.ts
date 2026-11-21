import db from "../setup.ts"
import type { MusicSource, Playlist } from "../../../shared/types.ts";
import getTracks from "../tracks/get.ts";

const getPlaylistStmt = db.prepare(`
  SELECT 
    p.id, p.name, p.source, p.thumbnail, p.duration, p.lastFetched, p.etag,
    -- Group all connected track IDs into a JSON array: '["id1", "id2"]'
    json_group_array(pt.track_id ORDER BY pt.addedAt DESC) as track_ids_json
  FROM playlists p
  LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
  WHERE p.id = $id
  GROUP BY p.id;
`);

const playlistMissingSinceStmt = db.prepare(`SELECT missingSince FROM playlists WHERE id = ?;`);

/**
 * True while a playlist is known to be unavailable (deleted, or private and
 * therefore invisible to the API key). YouTube answers 404 for those on every
 * request, so callers skip them until the window expires.
 */
export function isPlaylistMissing(id: string, ttlMs: number): boolean {
    const row = playlistMissingSinceStmt.get(id) as { missingSince: number | null } | null;
    if (!row?.missingSince) return false;
    return Date.now() - row.missingSince < ttlMs;
}


export default function getPlaylist(id: string, includeTracks: boolean = true): Playlist | null {
    interface PlaylistRow {
        id: string; name: string; source: MusicSource;
        thumbnail: string; duration: number; lastFetched: number | null; etag: string | null; track_ids_json: string;
    }
    const row = getPlaylistStmt.get({ $id: id }) as PlaylistRow;
    if (!row) return null;

    let trackIds: string[] = JSON.parse(row.track_ids_json);

    if (trackIds.length === 1 && trackIds[0] === null) {
        trackIds = [];
    }

    const playlist: Playlist = {
        id: row.id,
        name: row.name,
        source: row.source,
        thumbnail: row.thumbnail,
        duration: row.duration,
        ids: trackIds,
        lastFetched: row.lastFetched ?? undefined,
        etag: row.etag ?? undefined,
    };

    if (includeTracks && trackIds.length > 0) {
        playlist.tracks = getTracks(trackIds);
        playlist.ids = playlist.tracks.map(t => t.id);
    }

    return playlist;
}