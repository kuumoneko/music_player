using System.ComponentModel;
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

public record TrackRow(string Source, string Type, string Id, string Title, string Artist, string Thumbnail, string DurationText, TrackDto? Payload = null) : INotifyPropertyChanged
{
    private bool _isPlaying;

    public static TrackRow FromTrack(TrackDto track)
    {
        var row = new TrackRow(
            Source: track.Source, Type: MusicType.Track, Id: track.Id,
            Title: track.Name, Artist: string.Join(", ", track.Artist.Select(a => a.Name)),
            Thumbnail: track.Thumbnail, DurationText: FormatDuration(track.Duration), Payload: track);
        row.IsPlaying = NowPlaying.Matches(track.Source, track.Id);
        return row;
    }

    public bool IsPlaying
    {
        get => _isPlaying;
        set
        {
            if (_isPlaying == value)
            {
                return;
            }
            _isPlaying = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsPlaying)));
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(NowPlayingOpacity)));
        }
    }

    /// <summary>Classic bindings cannot cast a bool to <c>Opacity</c>, so the marker binds this.</summary>
    public double NowPlayingOpacity => _isPlaying ? 1 : 0;

    public event PropertyChangedEventHandler? PropertyChanged;

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
        var id = nextfromId ?? track.Id ?? "";
        try
        {
            AppLog.Write("playback", $"play: item={track.Id} source={source} type={type} id={id}");
            await App.Services.Api.PlayAsync(track, source, type, id);
        }
        catch (Exception ex)
        {
            AppLog.Write("playback", $"play failed: {ex.Message}");
            ToastService.ShowError($"Play failed: {ex.Message}");
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
            AppLog.Write("playback", $"play entry: item={track.Id} source={source} type={type} id={id}");
            await App.Services.Api.PlayAsync(track, source, type, id);
        }
        catch (Exception ex)
        {
            AppLog.Write("playback", $"play entry failed: {ex.Message}");
            ToastService.ShowError($"Play failed: {ex.Message}");
        }
    }
}
