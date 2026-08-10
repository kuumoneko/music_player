using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public record MediaCard(string Kind, string Source, string Type, string Id, string Title, string Subtitle, string Thumbnail)
{
    public static MediaCard FromTrack(TrackDto track) => new(
        Kind: "track", Source: track.Source, Type: MusicType.Track, Id: track.Id,
        Title: track.Name, Subtitle: string.Join(", ", track.Artist.Select(a => a.Name)),
        Thumbnail: track.Thumbnail);

    public static MediaCard FromPlaylist(PlaylistDto playlist) => new(
        Kind: "playlist", Source: playlist.Source, Type: MusicType.Playlist, Id: playlist.Id,
        Title: playlist.Name, Subtitle: TrackCountText(playlist), Thumbnail: playlist.Thumbnail);

    private static string TrackCountText(PlaylistDto playlist)
    {
        var count = playlist.ItemCount ?? playlist.Tracks?.Length ?? playlist.Ids?.Length;
        return count is not null ? $"{count} tracks" : "Unknown count";
    }

    public static MediaCard FromArtist(ArtistDto artist) => new(
        Kind: "artist", Source: artist.Source, Type: MusicType.Artist, Id: artist.Id,
        Title: artist.Name, Subtitle: "Artist", Thumbnail: artist.Thumbnail);
}

public record CollectionNav(string Title, MediaCard[] Cards, string SourceKey = "", Func<Task<MediaCard[]>>? Reload = null);

public record TrackRow(string Source, string Type, string Id, string Title, string Artist, string Thumbnail, string DurationText, TrackDto? Payload = null)
{
    public static TrackRow FromTrack(TrackDto track) => new(
        Source: track.Source, Type: MusicType.Track, Id: track.Id,
        Title: track.Name, Artist: string.Join(", ", track.Artist.Select(a => a.Name)),
        Thumbnail: track.Thumbnail, DurationText: FormatDuration(track.Duration), Payload: track);

    public static string FormatDuration(int ms)
    {
        var total = Math.Max(0, ms / 1000);
        return $"{total / 60}:{total % 60:00}";
    }
}

public record DownloadQueueItem(
    string Source,
    string Type,
    string Id,
    string Name,
    string Thumbnail,
    string ModeLabel,
    string Subtitle,
    TrackRow[] Tracks);

public static class Playback
{
    public static async Task PlayTrackAsync(TrackDto track, string? nextfromSource = null, string? nextfromType = null, string? nextfromId = null)
    {
        var source = track.Source ?? nextfromSource ?? MusicSource.Youtube;
        var type = source == MusicSource.Local ? MusicType.Local : (nextfromType ?? MusicType.Track);
        var id = track.Id ?? nextfromId ?? "";
        try
        {
            await App.Services.Api.PlayAsync(track, source, type, id);
        }
        catch (Exception ex)
        {
            AppLog.Write("playback", $"play failed: {ex.Message}");
        }
    }

    public static async Task PlayEntryAsync(string entry, TrackDto? payload = null)
    {
        var parts = entry.Split(':');
        var source = parts[0];
        var type = parts.Length > 1 ? parts[1] : MusicType.Track;
        var id = parts.Length > 2 ? parts[2] : (parts.Length > 1 ? parts[1] : "");
        var track = payload ?? new TrackDto("", id, [], source, "", 0, "");
        try
        {
            await App.Services.Api.PlayAsync(track, source, type, id);
        }
        catch (Exception ex)
        {
            AppLog.Write("playback", $"play entry failed: {ex.Message}");
        }
    }
}
