import db from "../setup.ts"
import type { Artist, Track } from "../../../shared/types.ts";

const getArtistWithTracksStmt = db.prepare(`
  SELECT 
    a.id, a.name, a.source, a.thumbnail, a.playlistId,
    t.id as track_id, t.name as track_name, t.source as track_source,
    t.thumbnail as track_thumbnail, t.duration, t.releasedDate,
    json_group_array(
      json_object('id', ta2.artist_id, 'name', ta2.artist_name)
    ) as track_artists_json
  FROM artists a
  LEFT JOIN track_artists ta ON a.id = ta.artist_id
  LEFT JOIN tracks t ON ta.track_id = t.id
  LEFT JOIN track_artists ta2 ON t.id = ta2.track_id
  WHERE a.id = $id
  GROUP BY t.id, a.id;
`);

export default function getArtistById(id: string, includeTracks: boolean = true): Artist | null {
  const rows = getArtistWithTracksStmt.all({ $id: id }) as {
    id: string, name: string, source: "local" | "youtube",
    playlistId: string, thumbnail: string,
    track_id: string | null, track_name: string | null,
    track_source: string | null, track_thumbnail: string | null,
    duration: number | null, releasedDate: string | null,
    track_artists_json: string,
  }[];

  if (!rows || rows.length === 0) return null;

  const artist: Artist = {
    id: rows[0].id,
    name: rows[0].name,
    source: rows[0].source,
    thumbnail: rows[0].thumbnail,
    playlistId: rows[0].playlistId,
    tracks: [],
  };

  if (includeTracks) {
    for (const row of rows) {
      if (!row.track_id) continue;
      let parsedArtists = JSON.parse(row.track_artists_json);
      if (parsedArtists.length === 1 && parsedArtists[0]?.id === null) {
        parsedArtists = [];
      }
      artist.tracks.push({
        id: row.track_id,
        name: row.track_name ?? "",
        source: row.track_source as "youtube" | "local",
        thumbnail: row.track_thumbnail ?? "",
        duration: row.duration ?? 0,
        releasedDate: row.releasedDate ?? "",
        artist: parsedArtists,
      } as Track);
    }
  }

  return artist;
}