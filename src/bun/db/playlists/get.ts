import db from "../setup.ts"
import type { Playlist } from "../../../shared/types.ts";
import getTracks from "../tracks/get.ts";

const getPlaylistStmt = db.prepare(`
  SELECT 
    p.id, p.name, p.source, p.thumbnail, p.duration,
    -- Group all connected track IDs into a JSON array: '["id1", "id2"]'
    json_group_array(pt.track_id) as track_ids_json
  FROM playlists p
  LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
  WHERE p.id = $id
  GROUP BY p.id;
`);


export default function getPlaylist(id: string, includeTracks: boolean = true): Playlist | null {
    const row = getPlaylistStmt.get({ $id: id }) as any;
    if (!row) return null;

    let trackIds: string[] = JSON.parse(row.track_ids_json);

    if (trackIds.length === 1 && trackIds[0] === null) {
        trackIds = [];
    }

    const playlist: Playlist = {
        id: row.id,
        // etag: row.etag || undefined,
        name: row.name,
        source: row.source,
        thumbnail: row.thumbnail,
        duration: row.duration,
        ids: trackIds,
    };

    if (includeTracks && trackIds.length > 0) {
        playlist.tracks = getTracks(trackIds);
    }

    return playlist;
}