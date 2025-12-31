import { Artist, Playlist, Track } from "@/types/index.ts";
import { useEffect, useState } from "react";
import { formatDuration, remove_hashtag } from "@/utils/format.ts";
import { goto } from "@/utils/url.ts";
import Play from "@/components/Show/common/play.ts";
import fetchdata from "@/utils/fetch.ts";

export default function HomePage() {
    const [artists, setartists] = useState([]);
    const [playlists, setplaylists] = useState([]);
    const [new_tracks, setnew_tracks] = useState([]);
    useEffect(() => {
        async function run() {
            const temp = await fetchdata("home", "GET");
            setartists(temp.artist);
            setplaylists(temp.playlist);
            const tempp = temp.new_tracks.sort((a: Track, b: Track) => {
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
                                    key={artist.id}
                                    className="flex flex-row items-center mr-4 my-3 bg-slate-600 p-2 rounded-4xl hover:bg-slate-500 hover:cursor-pointer"
                                    onClick={() => {
                                        goto(
                                            `/artists/${artist.source}/${artist.id}`
                                        );
                                    }}
                                >
                                    <div>
                                        <img
                                            className="mr-2 rounded-2xl"
                                            src={artist.thumbnail}
                                            height={50}
                                            width={50}
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
                                    key={playlist.id}
                                    className="flex flex-row items-center mr-4 my-3 bg-slate-600 p-2 rounded-4xl hover:bg-slate-500 hover:cursor-pointer"
                                    onClick={() => {
                                        goto(
                                            `/playlists/${playlist.source}/${playlist.id}`
                                        );
                                    }}
                                >
                                    <img
                                        className="mr-2 rounded-2xl"
                                        src={playlist.thumbnail}
                                        height={
                                            playlist.source === "spotify"
                                                ? 60
                                                : 50
                                        }
                                        width={
                                            playlist.source === "spotify"
                                                ? 60
                                                : 80
                                        }
                                    />
                                    <div>{playlist.name.slice(0, 25)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {new_tracks.length > 0 && (
                <div className="grid grid-cols-3 gap-4 overflow-y-scroll [&::-webkit-scrollbar]:hidden">
                    {new_tracks.map((track: Track) => {
                        return (
                            <div
                                key={track.id}
                                className="flex flex-row items-center rounded-2xl hover:cursor-pointer hover:bg-slate-600"
                                onClick={() => {
                                    Play(
                                        track,
                                        track.source,
                                        "track",
                                        track.id,
                                        [track]
                                    );
                                }}
                            >
                                <img
                                    className="mr-2 rounded-2xl"
                                    src={track.thumbnail}
                                    alt=""
                                />
                                <div className="flex flex-col">
                                    <div>{remove_hashtag(track.name)}</div>
                                    <div className="flex flex-row">
                                        <div className="mr-4">
                                            {track.artist[0].name}
                                        </div>
                                        <div>
                                            {formatDuration(
                                                track.duration / 1000
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
