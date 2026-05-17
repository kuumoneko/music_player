import db from "../setup.ts"
import type { Artist } from "../../../shared/types.ts";
import getTracks from "../tracks/get.ts";

const getArtistByIdStmt = db.prepare(`
  SELECT 
    a.id, a.name, a.source, a.thumbnail, a.playlistId,
    -- Group all track IDs associated with this artist into a JSON array
    json_group_array(ta.track_id) as track_ids_json
  FROM artists a
  LEFT JOIN track_artists ta ON a.id = ta.artist_id
  WHERE a.id = $id
  GROUP BY a.id;
`);

export default function getArtistById(id: string, includeTracks: boolean = true): Artist | null {
  const row = getArtistByIdStmt.get({ $id: id }) as any;
  if (!row) return null;

  let trackIds: string[] = JSON.parse(row.track_ids_json);

  if (trackIds.length === 1 && trackIds[0] === null) {
    trackIds = [];
  }

  const artist: Artist = {
    id: row.id,
    // etag: row.etag || undefined,
    name: row.name,
    source: row.source,
    thumbnail: row.thumbnail,
    playlistId: row.playlistId,
    tracks: []
  };

  if (includeTracks && trackIds.length > 0) {
    artist.tracks = getTracks(trackIds);
  }

  return artist;
}