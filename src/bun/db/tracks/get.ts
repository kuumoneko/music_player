import type { Track } from "../../../shared/types.ts";
import db from "../setup.ts"

const getMultipleTracksStmt = db.prepare(`
  SELECT 
    t.id, t.name, t.source, t.thumbnail, 
    t.duration, t.releasedDate,
    json_group_array(
      json_object('id', ta.artist_id, 'name', ta.artist_name)
    ) as artists_json
  FROM tracks t
  LEFT JOIN track_artists ta ON t.id = ta.track_id 
  WHERE t.id IN (SELECT value FROM json_each($ids))
  GROUP BY t.id;
`);

export default function getTracks(ids: string[]): Track[] {
  if (!ids || ids.length === 0) return [];

  const results = getMultipleTracksStmt.all({
    $ids: JSON.stringify(ids)
  }) as any[];

  return results.map((row) => {
    let parsedArtists = JSON.parse(row.artists_json);

    if (parsedArtists.length === 1 && parsedArtists[0].id === null) {
      parsedArtists = [];
    }

    return {
      id: row.id,
      name: row.name,
      source: row.source,
      thumbnail: row.thumbnail,
      duration: row.duration,
      releasedDate: row.releasedDate,
      artist: parsedArtists
    };
  });
}

export function getTrackByName(name: string, exact: boolean = false): Track[] {
  const getTracksByNameStmt = db.prepare(`
  SELECT 
    t.id, t.name, t.source, t.thumbnail, 
    t.duration, t.releasedDate, t.liveBroadcastContent,
    json_group_array(
      json_object('id', ta.artist_id, 'name', ta.artist_name)
    ) as artists_json
  FROM tracks t
  LEFT JOIN track_artists ta ON t.id = ta.track_id
  WHERE t.name LIKE $query
  GROUP BY t.id;
`);
  const query = exact ? name : `%${name}%`;

  const results = getTracksByNameStmt.all({ $query: query }) as any[];

  return results.map((row) => {
    let parsedArtists = JSON.parse(row.artists_json);

    if (parsedArtists.length === 1 && parsedArtists[0].id === null) {
      parsedArtists = [];
    }

    return {
      id: row.id,
      name: row.name,
      source: row.source,
      thumbnail: row.thumbnail,
      duration: row.duration,
      releasedDate: row.releasedDate,
      artist: parsedArtists
    };
  });
}

export function getAllTracks() {
  try {
    const rows = db.prepare("SELECT id FROM tracks").all() as { id: string }[];
    return rows.map(r => ({ id: r.id }));
  } catch { return []; }
}
