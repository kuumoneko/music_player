import getPlaylist from "./playlists/get.ts";
import createPlaylist from "./playlists/create.ts";
import deletePlaylist from "./playlists/delete.ts";
import getAllPlaylists from "./playlists/list.ts";
import addTrackToPlaylist from "./playlists/addTrack.ts";
import removeTrackFromPlaylist from "./playlists/removeTrack.ts";
import setupSQLite from "./setup.ts";
import getTracks, { getTrackByName, getAllTracks } from "./tracks/get.ts";
import writeTracks from "./tracks/write.ts";
import deleteTracks, { deleteStaleTrackArtists } from "./tracks/delete.ts";
import writePlaylist from './playlists/write.ts';
import { getLocalFileById, getAllLocalFiles, getAllLocalFileIds, searchLocalFiles } from './local/get.ts';
import writeLocalFiles from './local/write.ts';
import getArtistById, { getArtistByPlaylistId } from './artists/get.ts';
import writeArtist from './artists/write.ts';
import getUserData, { getUserDatas } from './user/get.ts';
import writeUserData, { writeUserDatas } from './user/write.ts';
import getSystemData, { getSystemDefaults } from './system/get.ts';
import writeSystemData from './system/write.ts';
import { seedSystemFromAssets } from './system/seed.ts';
import writeLogs from './log/write.ts';
import deleteLogs from './log/delete.ts';
import { getSearchCache, purgeExpiredSearchCache } from './cache/get.ts';
import setSearchCache from './cache/write.ts';

export {
    setupSQLite,
    getTracks,
    writeTracks,
    getPlaylist,
    writePlaylist,
    createPlaylist,
    deletePlaylist,
    getAllPlaylists,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    getLocalFileById,
    getAllLocalFiles,
    getAllLocalFileIds,
    searchLocalFiles,
    writeLocalFiles,
    getArtistById,
    getArtistByPlaylistId,
    writeArtist,
    getUserData,
    writeUserData,
    getUserDatas,
    writeUserDatas,
    getSystemData,
    getSystemDefaults,
    writeSystemData,
    seedSystemFromAssets,
    getTrackByName,
    getAllTracks,
    deleteTracks,
    deleteStaleTrackArtists,
    writeLogs,
    deleteLogs,
    getSearchCache,
    setSearchCache,
    purgeExpiredSearchCache
}