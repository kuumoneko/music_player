import { getPlaylist } from "./playlists/get.ts";
import setupSQLite from "./setup";
import { getTracks } from "./tracks/get.ts"
import { writeManyTracks } from "./tracks/write.ts";
import { writePlaylist } from './playlists/write';
import { getLocalFileById, getLocalFileByIndex, getAllLocalFiles } from './local/get';
import { writeManyLocalFiles } from './local/write';
import { getArtistById } from './artists/get';
import writeArtist from './artists/write';

export { setupSQLite, getTracks, writeManyTracks, getPlaylist, writePlaylist, getLocalFileById, getLocalFileByIndex, getAllLocalFiles, writeManyLocalFiles, getArtistById, writeArtist }