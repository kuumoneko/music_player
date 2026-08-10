import db from "../setup.ts"
import type { MusicSource, Playlist } from "../../../shared/types.ts";
import getTracks from "../tracks/get.ts";

const listStmt = db.prepare(`
  SELECT 
    p.id, p.name, p.source, p.thumbnail, p.duration,
    json_group_array(pt.track_id) as track_ids_json
  FROM playlists p
  LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
  WHERE p.source = 'local'
  GROUP BY p.id
  ORDER BY p.rowid DESC
`);

export default function getAllPlaylists(): Playlist[] {
    interface PlaylistRow {
        id: string; name: string; source: MusicSource;
        thumbnail: string; duration: number; track_ids_json: string;
    }
    const rows = listStmt.all() as PlaylistRow[];
    return rows.map((row) => {
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
        };
        if (trackIds.length > 0) {
            playlist.tracks = getTracks(trackIds);
        }
        return playlist;
    });
}
