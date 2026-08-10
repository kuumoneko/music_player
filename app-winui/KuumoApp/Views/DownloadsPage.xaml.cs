using System.Text.Json;
using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace KuumoApp.Views;

public sealed partial class DownloadsPage : Page
{
    private string[] _queue = [];

    public DownloadsPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        App.Services.Rpc.Connected += OnRpcConnected;
        App.Services.Events.DownloadStatusChanged += OnStatusChanged;
        if (App.Services.Rpc.IsConnected)
        {
            _ = LoadAsync();
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        App.Services.Rpc.Connected -= OnRpcConnected;
        App.Services.Events.DownloadStatusChanged -= OnStatusChanged;
    }

    private void OnRpcConnected() => DispatcherQueue.TryEnqueue(() => _ = LoadAsync());

    private void OnStatusChanged(DownloadStatusDto status) => DispatcherQueue.TryEnqueue(() => RenderStatus(status));

    private async Task LoadAsync()
    {
        try
        {
            var entries = (await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.DownloadQueue))?.ToList() ?? [];

            var playlists = new List<(string Source, string Mode, string Id)>();
            var tracks = new List<(string Source, string Mode, string Id)>();
            var allResolved = true;

            foreach (var entry in entries)
            {
                var parts = entry.Split(':');
                var source = parts.Length > 0 ? parts[0] : MusicSource.Youtube;
                var mode = parts.Length > 1 ? parts[1] : MusicType.Track;
                var id = parts.Length > 2 ? parts[2] : (parts.Length > 1 ? parts[1] : "");
                if (mode == MusicType.Artist)
                {
                    try
                    {
                        var data = await App.Services.Api.GetMusicDataAsync(source, MusicType.Artist, id);
                        if (data is JsonElement el && el.ValueKind == JsonValueKind.Object && el.TryGetProperty("playlistId", out var pidEl))
                        {
                            var playlistId = pidEl.GetString();
                            if (!string.IsNullOrEmpty(playlistId))
                            {
                                playlists.Add((source, MusicType.Playlist, playlistId));
                                continue;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        AppLog.Write("downloads", $"resolve artist {id} failed: {ex.Message}");
                    }
                    allResolved = false;
                }
                else if (mode == MusicType.Playlist)
                {
                    playlists.Add((source, mode, id));
                    continue;
                }
                tracks.Add((source, mode, id));
            }

            var items = new List<DownloadQueueItem>();
            foreach (var (source, mode, id) in playlists)
            {
                try
                {
                    var data = await App.Services.Api.GetMusicDataAsync(source, MusicType.Playlist, id);
                    if (data is not JsonElement el || el.ValueKind != JsonValueKind.Object)
                    {
                        allResolved = false;
                    }
                    else
                    {
                        var playlist = JsonSerializer.Deserialize<PlaylistDto>(el, RpcClient.Json);
                        if (playlist is null)
                        {
                            allResolved = false;
                        }
                        else
                        {
                            var nested = new List<TrackRow>();
                            var playlistTrackIds = new HashSet<string>();
                            foreach (var t in playlist.Tracks ?? [])
                            {
                                playlistTrackIds.Add(t.Id);
                                nested.Add(TrackRow.FromTrack(t));
                            }
                            tracks = tracks.Where(t => !playlistTrackIds.Contains(t.Id)).ToList();
                            items.Add(new DownloadQueueItem(
                                source, MusicType.Playlist, id, playlist.Name, playlist.Thumbnail,
                                "Playlist", $"{nested.Count} tracks", nested.ToArray()));
                            continue;
                        }
                    }
                }
                catch (Exception ex)
                {
                    AppLog.Write("downloads", $"resolve playlist {id} failed: {ex.Message}");
                    allResolved = false;
                }
                items.Add(new DownloadQueueItem(source, MusicType.Playlist, id, "Unavailable", "", "Playlist", "", []));
            }

            foreach (var (source, mode, id) in tracks)
            {
                try
                {
                    var data = await App.Services.Api.GetMusicDataAsync(source, mode, id);
                    if (data is not JsonElement el || el.ValueKind != JsonValueKind.Object)
                    {
                        allResolved = false;
                    }
                    else
                    {
                        var track = JsonSerializer.Deserialize<TrackDto>(el, RpcClient.Json);
                        if (track is null)
                        {
                            allResolved = false;
                        }
                        else
                        {
                            items.Add(new DownloadQueueItem(
                                source, mode, id, track.Name, track.Thumbnail,
                                "Track", string.Join(", ", track.Artist.Select(a => a.Name)), []));
                            continue;
                        }
                    }
                }
                catch (Exception ex)
                {
                    AppLog.Write("downloads", $"resolve track {id} failed: {ex.Message}");
                    allResolved = false;
                }
                items.Add(new DownloadQueueItem(source, mode, id, "Unavailable", "", "Track", "", []));
            }

            var normalized = new List<string>();
            foreach (var item in items)
            {
                normalized.Add($"{item.Source}:{item.Type}:{item.Id}");
            }
            _queue = normalized.ToArray();
            var current = (await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.DownloadQueue))?.ToList() ?? [];
            if (allResolved && !current.SequenceEqual(_queue))
            {
                await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, _queue);
            }

            QueueList.ItemsSource = items;
            EmptyText.Visibility = items.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            ClearButton.IsEnabled = items.Count > 0;
        }
        catch (Exception ex)
        {
            AppLog.Write("downloads", $"load failed: {ex.Message}");
        }
    }

    private void RenderStatus(DownloadStatusDto status)
    {
        StatusText.Text = string.IsNullOrEmpty(status.Track) ? status.Data : $"{status.Data}: {status.Track}";
        var busy = status.Data == Status.Downloading || status.Data == Status.Prepare;
        Progress.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
        DownloadButton.IsEnabled = !busy;
    }

    private async void OnDownloadClick(object sender, RoutedEventArgs e)
    {
        DownloadButton.IsEnabled = false;
        try
        {
            await App.Services.Api.DownloadMusicAsync();
        }
        catch (Exception ex)
        {
            StatusText.Text = ex.Message;
        }
        finally
        {
            DownloadButton.IsEnabled = true;
        }
    }

    private async void OnRemoveClick(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: DownloadQueueItem item })
        {
            return;
        }
        var entry = $"{item.Source}:{item.Type}:{item.Id}";
        var remaining = _queue.Where(q => q != entry).ToArray();
        _queue = remaining;
        await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, remaining);
        await LoadAsync();
    }

    private void OnCopyClick(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: DownloadQueueItem item })
        {
            return;
        }
        if (item.Source != MusicSource.Youtube)
        {
            return;
        }
        if (item.Type == MusicType.Playlist)
        {
            ClipboardService.CopyPlaylist(item.Id);
        }
        else
        {
            ClipboardService.CopyTrack(item.Source, item.Id);
        }
    }

    private async void OnClearClick(object sender, RoutedEventArgs e)
    {
        var dialog = new ContentDialog
        {
            Title = "Clear queue",
            Content = "Clear the entire download queue?",
            PrimaryButtonText = "Yes",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close,
            XamlRoot = XamlRoot,
        };
        if (await dialog.ShowAsync() == ContentDialogResult.Primary)
        {
            _queue = [];
            await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, Array.Empty<string>());
            await LoadAsync();
        }
    }
}
