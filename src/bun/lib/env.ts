import { Repeat, Shuffle, UserData } from '../../shared/types.ts';
import { deleteLogs, getUserData, writeUserData } from '../db/index.ts';

export default function CheckUserData() {
    const defaultUserData = [
        { key: "repeat", value: Repeat.Disable },
        { key: "shuffle", value: Shuffle.Disable },
        { key: "volume", value: 50 },
        {
            key: "currentPlaying",
            value: {
                source: "",
                id: "",
                title: "",
                thumbnail: "",
                artist: "",
                index: null
            }
        },
        {
            key: "nextfrom",
            value: ""
        },
        { key: "playedTrack", value: [] },
        { key: "QuitOnClose", value: false },
        { key: "closeToTray", value: false },
        {
            key: "current",
            value: { duration: 0, isLived: false }
        },
        { key: "isPlaying", value: false },
        { key: "isLoading", value: false },
        { key: "playQueue", value: [] },
        { key: "batchQueue", value: [] },
        { key: "folder", value: "" },
        { key: "pin", value: [] },
        { key: "downloadQueue", value: [] }
    ]

    for (const item of defaultUserData) {
        const checking = getUserData(item.key as keyof UserData);
        if (checking === null || checking === undefined) {
            writeUserData(item.key as keyof UserData, item.value as UserData[keyof UserData]);
        }
    }

    deleteLogs();
}