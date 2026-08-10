import db from "../setup.ts"
import type { Playlist } from "../../../shared/types.ts";
import { randomUUID } from "node:crypto";

const insertStmt = db.prepare(`
  INSERT INTO playlists (id, name, source, thumbnail, duration)
  VALUES ($id, $name, $source, $thumbnail, $duration)
`);

export default function createPlaylist(name: string): Playlist {
    const id = randomUUID();
    insertStmt.run({
        $id: id,
        $name: name,
        $source: "local",
        $thumbnail: "",
        $duration: 0,
    });
    return {
        id,
        name,
        source: "local" as any,
        thumbnail: "",
        duration: 0,
        tracks: [],
        ids: [],
    };
}
