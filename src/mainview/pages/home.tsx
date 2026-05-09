import { Artist, Playlist, Track } from "@/shared/types.ts";
import { useEffect, useState } from "react";
import { formatDuration, remove_hashtag } from "@/mainview/utils/format.ts";
import { goto } from "@/mainview/utils/url.ts";

export default function HomePage() {
    const [artists, setartists] = useState([]);
    const [playlists, setplaylists] = useState([]);
    const [tracks, settracks] = useState([]);
    const [new_tracks, setnew_tracks] = useState([]);

    useEffect(() => {
        async function run() {
            const temp = await window.api.rpc.request.getHomeData();
            setartists(temp.artists ?? []);
            setplaylists(temp.playlists ?? []);
            settracks(temp.tracks ?? []);
            const tempp = (temp.newTracks ?? []).sort((a: Track, b: Track) => {
                const [yearA, monthA, dayA] = a.releasedDate
                    .split("-")
                    .map(Number);
                const [yearB, monthB, dayB] = b.releasedDate
                    .split("-")
                    .map(Number);

                const dateA = new Date(yearA, monthA - 1, dayA);
                const dateB = new Date(yearB, monthB - 1, dayB);

                return dateB.getTime() - dateA.getTime();
            });
            setnew_tracks(tempp);
        }
        run();
    }, []);
    return (
        <div className="flex flex-col items-center justify-start h-full w-full">
            {artists.length > 0 && (
                <div className="flex flex-col items-center">
                    <h1 className="text-2xl font-bold">Artists</h1>
                    <div className="flex flex-row overflow-x-scroll [&::-webkit-scrollbar]:hidden">
                        {artists.map((artist: Artist) => {
                            return (
                                <div
                                    className="flex flex-row items-center mr-4 my-3 bg-zinc-600 p-2 rounded-4xl hover:bg-zinc-500 hover:cursor-pointer"
                                    onClick={() => {
                                        goto(
                                            `/artists/${artist.source}/${artist.id}`,
                                        );
                                    }}
                                >
                                    <div>
                                        <img
                                            className="mr-2 rounded-2xl"
                                            src={artist.thumbnail}
                                            height={50}
                                            width={50}
                                            alt={artist.name}
                                        />
                                    </div>
                                    <div>{artist.name}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {playlists.length > 0 && (
                <div className="flex flex-col items-center">
                    <h1 className="text-2xl font-bold">Playlists</h1>
                    <div className="flex flex-row items-center">
                        {playlists.map((playlist: Playlist) => {
                            return (
                                <div
                                    className="flex flex-row items-center mr-4 my-3 bg-zinc-600 p-2 rounded-4xl hover:bg-zinc-500 hover:cursor-pointer"
                                    onClick={() => {
                                        goto(
                                            `/playlists/${playlist.source}/${playlist.id}`,
                                        );
                                    }}
                                >
                                    <img
                                        className="mr-2 rounded-2xl"
                                        src={playlist.thumbnail}
                                        height="50"
                                        width="80"
                                        alt={playlist.name}
                                    />
                                    <div>{playlist.name.slice(0, 25)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {tracks.length > 0 && (
                <div className="flex flex-col items-center">
                    <h1 className="text-2xl font-bold">Tracks</h1>
                    <div className="flex flex-row">
                        {tracks.map((track: Track) => {
                            return (
                                <div
                                    className="flex flex-row items-center mr-4 my-3 bg-zinc-600 p-2 rounded-4xl hover:bg-zinc-500 hover:cursor-pointer"
                                    onClick={() => {
                                        window.api.rpc.request.play({
                                            item: track,
                                            source: track.source as any,
                                            type: "track",
                                            id: track.id,
                                        });
                                    }}
                                >
                                    <img
                                        className="mr-2 rounded-2xl"
                                        src={track.thumbnail}
                                        height="50"
                                        width="80"
                                        alt={track.name}
                                    />
                                    <div>
                                        {remove_hashtag(
                                            track.name.slice(0, 25),
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {new_tracks.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-4 overflow-y-scroll [&::-webkit-scrollbar]:hidden">
                    {new_tracks.map((track: Track) => {
                        return (
                            <div
                                className="flex flex-row items-center rounded-2xl hover:cursor-pointer hover:bg-zinc-600"
                                onClick={() => {
                                    window.api.rpc.request.play({
                                        item: track,
                                        source: track.source as any,
                                        type: "track",
                                        id: track.id,
                                    });
                                }}
                            >
                                <img
                                    className="mr-2 rounded-2xl"
                                    src={track.thumbnail}
                                    alt={track.name}
                                />
                                <div className="flex flex-col">
                                    <div>{remove_hashtag(track.name)}</div>
                                    <div className="flex flex-row">
                                        <div className="mr-4">
                                            {track.artist[0].name}
                                        </div>
                                        <div>
                                            {formatDuration(
                                                track.duration / 1000,
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
