using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;

namespace KuumoApp.Services;

public sealed class ClipboardService
{
    private const string YtbTrackStart = "https://www.youtube.com/watch?v=";

    private static Window? GetMainWindow()
    {
        if (Application.Current?.ApplicationLifetime
            is IClassicDesktopStyleApplicationLifetime { MainWindow: { } window })
        {
            return window;
        }
        return null;
    }

    public static async void CopyTrack(string source, string id)
    {
        var url = source == Models.MusicSource.Youtube
            ? $"{YtbTrackStart}{id}"
            : $"kuumo://track/{id}";
        await SetTextAsync(url);
    }

    public static async void CopyPlaylist(string id)
        => await SetTextAsync($"https://www.youtube.com/playlist?list={id}");

    public static async void CopyArtist(string channelId)
        => await SetTextAsync($"https://www.youtube.com/channel/{channelId}");

    public static async void CopyText(string text) => await SetTextAsync(text);

    private static async System.Threading.Tasks.Task SetTextAsync(string text)
    {
        try
        {
            var window = GetMainWindow();
            if (window?.Clipboard is not null)
            {
                await window.Clipboard.SetTextAsync(text);
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("clipboard", $"failed: {ex.Message}");
        }
    }
}