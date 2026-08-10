using Windows.ApplicationModel.DataTransfer;

namespace KuumoApp.Services;

public sealed class ClipboardService
{
    private const string YtbTrackStart = "https://www.youtube.com/watch?v=";

    public static void CopyTrack(string source, string id)
    {
        var url = source == Models.MusicSource.Youtube
            ? $"{YtbTrackStart}{id}"
            : $"kuumo://track/{id}";
        SetText(url);
    }

    public static void CopyPlaylist(string id)
        => SetText($"https://www.youtube.com/playlist?list={id}");

    public static void CopyArtist(string channelId)
        => SetText($"https://www.youtube.com/channel/{channelId}");

    public static void CopyText(string text) => SetText(text);

    private static void SetText(string text)
    {
        var package = new DataPackage { RequestedOperation = DataPackageOperation.Copy };
        package.SetText(text);
        Clipboard.SetContent(package);
    }
}
