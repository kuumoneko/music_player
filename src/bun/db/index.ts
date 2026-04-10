import getPlaylist from "./playlists/get.ts";
import setupSQLite from "./setup.ts";
import getTracks from "./tracks/get.ts";
import writeTracks from "./tracks/write.ts";
import writePlaylist from './playlists/write.ts';
import { getLocalFileById, getLocalFileByIndex, getAllLocalFiles } from './local/get.ts';
import writeLocalFiles from './local/write.ts';
import getArtistById from './artists/get.ts';
import writeArtist from './artists/write.ts';
import getUserData from './user/get.ts';
import writeUserData from './user/write.ts';
import { getUserDatas } from './user/get';
import { writeUserDatas } from './user/write';
import { getTrackByName } from './tracks/get';

export { setupSQLite, getTracks, writeTracks, getPlaylist, writePlaylist, getLocalFileById, getLocalFileByIndex, getAllLocalFiles, writeLocalFiles, getArtistById, writeArtist, getUserData, writeUserData, getUserDatas, writeUserDatas,getTrackByName }