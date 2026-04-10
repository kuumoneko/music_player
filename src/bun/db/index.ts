import getPlaylist from "./playlists/get.ts";
import setupSQLite from "./setup.ts";
import getTracks, { getTrackByName } from "./tracks/get.ts";
import writeTracks from "./tracks/write.ts";
import writePlaylist from './playlists/write.ts';
import { getLocalFileById, getLocalFileByIndex, getAllLocalFiles } from './local/get.ts';
import writeLocalFiles from './local/write.ts';
import getArtistById from './artists/get.ts';
import writeArtist from './artists/write.ts';
import getUserData, { getUserDatas } from './user/get.ts';
import writeUserData, { writeUserDatas } from './user/write.ts';
import getAllLogs from './log/get';
import writeLogs from './log/write';
import deleteLogs from './log/delete';

export {
    setupSQLite,
    getTracks,
    writeTracks,
    getPlaylist,
    writePlaylist,
    getLocalFileById,
    getLocalFileByIndex,
    getAllLocalFiles,
    writeLocalFiles,
    getArtistById,
    writeArtist,
    getUserData,
    writeUserData,
    getUserDatas,
    writeUserDatas,
    getTrackByName,
    getAllLogs,
    writeLogs,
    deleteLogs
}