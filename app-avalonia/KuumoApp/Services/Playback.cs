using KuumoApp.Models;

namespace KuumoApp.Services;

public static class Playback
{
    public static async System.Threading.Tasks.Task PlayTrackAsync(TrackDto track, string? nextfromSource = null, string? nextfromType = null, string? nextfromId = null)
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
        }
    }

    public static async System.Threading.Tasks.Task PlayEntryAsync(string entry, TrackDto? payload = null)
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
        }
    }
}