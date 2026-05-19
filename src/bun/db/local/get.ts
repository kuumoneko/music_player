import db from "../setup.ts"
import type { Track } from "../../../shared/types.ts";

function mapRowToTrack(row: any): Track {
  let parsedArtists = JSON.parse(row.artists_json);

  if (parsedArtists.length === 1 && parsedArtists[0].id === null) {
    parsedArtists = [];
  }

  return {
    id: row.id,
    name: row.name,
    source: row.source as "local",
    thumbnail: row.thumbnail,
    duration: row.duration,
    releasedDate: row.releasedDate,
    artist: parsedArtists
  };
}

const baseSelect = `
  SELECT 
    t.id, t.name, t.source, t.thumbnail, 
    t.duration, t.releasedDate, 
    json_group_array(
      json_object('id', ta.artist_id, 'name', ta.artist_name)
    ) as artists_json
  FROM tracks t
  LEFT JOIN track_artists ta ON t.id = ta.track_id
`;

const getAllLocalStmt = db.prepare(`
  ${baseSelect}
  WHERE t.source = 'local'
  GROUP BY t.id;
`);

const getLocalByIdStmt = db.prepare(`
  ${baseSelect}
  WHERE t.source = 'local' AND t.id = $id
  GROUP BY t.id;
`);

export function getAllLocalFiles(): Track[] {
  const results = getAllLocalStmt.all() as any[];
  return results.map(mapRowToTrack);
}

export function getLocalFileById(id: string): Track | null {
  const row = getLocalByIdStmt.get({ $id: id }) as any;
  if (!row) return null;
  return mapRowToTrack(row);
}