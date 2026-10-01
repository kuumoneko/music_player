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
    private bool _busy;
    private bool _isLocal = true;

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
            _ = LoadModeAsync();
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        App.Services.Rpc.Connected -= OnRpcConnected;
        App.Services.Events.DownloadStatusChanged -= OnStatusChanged;
    }

    private void OnRpcConnected() => DispatcherQueue.TryEnqueue(() =>
    {
        _ = LoadAsync();
        _ = LoadModeAsync();
    });

    private void OnStatusChanged(DownloadStatusDto status) => DispatcherQueue.TryEnqueue(() => RenderStatus(status));

    // getDownloadStatus returns null while downloads are off, so seeding from it also keeps the
    // page truthful after navigating away mid-download and back again.
    private async Task LoadModeAsync()
    {
        try
        {
            _isLocal = await App.Services.Api.GetIsLocalAsync();
            var status = await App.Services.Api.GetDownloadStatusAsync();
            if (status is not null)
            {
                RenderStatus(status);
            }
            RenderMode();
        }
        catch (Exception ex)
        {
            AppLog.Write("downloads", $"mode load failed: {ex.Message}");
        }
    }

    private void RenderMode()
    {
        if (!_isLocal)
        {
            _busy = false;
            DownloadButton.IsEnabled = false;
            Progress.Visibility = Visibility.Collapsed;
            StatusText.Text = "Downloads are off — choose a music folder in Settings first.";
            return;
        }
        DownloadButton.IsEnabled = !_busy;
    }

    private async Task LoadAsync()
    {
        try
        {
            var stored = (await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.DownloadQueue)) ?? [];

            var sources = new List<string>();
            var modes = new List<string>();
            var ids = new List<string>();
            var entryKeys = new List<string>();
            foreach (var raw in stored)
            {
                if (!EntryFormat.TryParse(raw, out var source, out var mode, out var id))
                {
                    continue;
                }
                sources.Add(source);
                modes.Add(mode);
                ids.Add(id);
                entryKeys.Add(EntryFormat.Build(source, mode, id));
            }

            // getQueueData is deliberately not rate limited, so the whole queue resolves in two
            // round trips. Resolving row by row through getMusicData hit the 500ms per-method
            // limiter and rendered every row after the first as "Unavailable".
            var primary = entryKeys.Count > 0
                ? await App.Services.Api.GetQueueDataAsync(entryKeys.ToArray()) ?? []
                : [];

            // An artist resolves to its uploads playlist id; expand those in a second batch.
            var artistPlaylistKeys = new List<string>();
            var artistSlot = new int[primary.Length];
            var artistPlaylistIds = new string?[primary.Length];
            for (var i = 0; i < primary.Length; i++)
            {
                artistSlot[i] = -1;
                if (modes[i] != MusicType.Artist)
                {
                    continue;
                }
                var playlistId = ReadString(primary[i], "playlistId");
                if (string.IsNullOrEmpty(playlistId))
                {
                    continue;
                }
                artistSlot[i] = artistPlaylistKeys.Count;
                artistPlaylistIds[i] = playlistId;
                artistPlaylistKeys.Add(EntryFormat.Build(sources[i], MusicType.Playlist, playlistId));
            }

            var artistPlaylists = artistPlaylistKeys.Count > 0
                ? await App.Services.Api.GetQueueDataAsync(artistPlaylistKeys.ToArray()) ?? []
                : [];

            var items = new List<DownloadQueueItem>();
            var coveredTrackIds = new HashSet<string>();
            var normalized = new List<string>();
            var allResolved = true;

            for (var i = 0; i < primary.Length; i++)
            {
                if (modes[i] != MusicType.Artist && modes[i] != MusicType.Playlist)
                {
                    continue;
                }

                string playlistSource;
                string playlistType;
                string playlistId;
                JsonElement? payload;
                if (modes[i] == MusicType.Artist)
                {
                    var slot = artistSlot[i];
                    if (slot < 0 || slot >= artistPlaylists.Length)
                    {
                        allResolved = false;
                        items.Add(Unavailable(sources[i], MusicType.Artist, ids[i], "Artist"));
                        normalized.Add(EntryFormat.Build(sources[i], MusicType.Artist, ids[i]));
                        continue;
                    }
                    playlistSource = sources[i];
                    playlistType = MusicType.Playlist;
                    playlistId = artistPlaylistIds[i]!;
                    payload = artistPlaylists[slot];
                }
                else
                {
                    playlistSource = sources[i];
                    playlistType = MusicType.Playlist;
                    playlistId = ids[i];
                    payload = primary[i];
                }

                var playlist = ReadAs<PlaylistDto>(payload);
                if (playlist is null)
                {
                    allResolved = false;
                    items.Add(Unavailable(playlistSource, playlistType, playlistId, "Playlist"));
                    normalized.Add(EntryFormat.Build(playlistSource, playlistType, playlistId));
                    continue;
                }

                var nested = new List<TrackRow>();
                foreach (var t in playlist.Tracks ?? [])
                {
                    coveredTrackIds.Add(t.Id);
                    nested.Add(TrackRow.FromTrack(t));
                }

                items.Add(new DownloadQueueItem(
                    playlistSource, playlistType, playlistId, playlist.Name, playlist.Thumbnail,
                    "Playlist", $"{nested.Count} tracks", nested.ToArray()));
                normalized.Add(EntryFormat.Build(playlistSource, playlistType, playlistId));
            }

            for (var i = 0; i < primary.Length; i++)
            {
                if (modes[i] == MusicType.Artist || modes[i] == MusicType.Playlist)
                {
                    continue;
                }

                var source = sources[i];
                var mode = modes[i];
                var id = ids[i];

                TrackDto? track;
                if (source == MusicSource.Local)
                {
                    // A local entry resolves to every local file; pick ours out of the batch.
                    track = ReadTracks(primary[i]).FirstOrDefault(t => t.Id == id);
                }
                else
                {
                    track = ReadAs<TrackDto>(primary[i]);
                }

                if (track is null || string.IsNullOrEmpty(track.Id))
                {
                    allResolved = false;
                    items.Add(Unavailable(source, mode, id, "Track"));
                    normalized.Add(EntryFormat.Build(source, mode, id));
                    continue;
                }

                if (coveredTrackIds.Contains(track.Id))
                {
                    continue;
                }

                items.Add(new DownloadQueueItem(
                    source, mode, id, track.Name, track.Thumbnail,
                    "Track", string.Join(", ", track.Artist.Select(a => a.Name)), []));
                normalized.Add(EntryFormat.Build(source, mode, id));
            }

            _queue = normalized.ToArray();
            var current = (await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.DownloadQueue)) ?? [];
            // Only rewrite when nothing was appended mid-load, so a concurrent add is never dropped.
            if (allResolved && current.SequenceEqual(stored) && !current.SequenceEqual(_queue))
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
            ToastService.ShowError($"Failed to load downloads: {ex.Message}");
        }
    }

    private static T? ReadAs<T>(JsonElement? element) where T : class
    {
        if (element is not { ValueKind: JsonValueKind.Object } obj)
        {
            return null;
        }
        try
        {
            return JsonSerializer.Deserialize<T>(obj, RpcClient.Json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ReadString(JsonElement? element, string name)
    {
        if (element is not { ValueKind: JsonValueKind.Object } obj)
        {
            return null;
        }
        return obj.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static TrackDto[] ReadTracks(JsonElement? element)
    {
        if (element is not { ValueKind: JsonValueKind.Object } obj
            || !obj.TryGetProperty("tracks", out var array)
            || array.ValueKind != JsonValueKind.Array)
        {
            return [];
        }
        var tracks = new List<TrackDto>();
        foreach (var item in array.EnumerateArray())
        {
            var track = ReadAs<TrackDto>(item);
            if (track is not null)
            {
                tracks.Add(track);
            }
        }
        return tracks.ToArray();
    }

    private static DownloadQueueItem Unavailable(string source, string type, string id, string modeLabel)
        => new(source, type, id, "Unavailable", "", modeLabel, "", []);

    private void RenderStatus(DownloadStatusDto status)
    {
        StatusText.Text = DescribeStatus(status);
        _busy = status.Data == Status.Downloading
            || status.Data == Status.Prepare
            || status.Data == Status.Env;
        var hasProgress = status.Progress is >= 0 and <= 100;
        if (hasProgress)
        {
            Progress.Value = status.Progress!.Value;
        }
        Progress.IsIndeterminate = !hasProgress;
        Progress.Visibility = _busy ? Visibility.Visible : Visibility.Collapsed;
        RenderMode();
    }

    private static string DescribeStatus(DownloadStatusDto status)
    {
        var label = status.Data switch
        {
            Status.Idle => "Idle",
            Status.Env => "Preparing download",
            Status.Prepare => "Resolving tracks",
            Status.Downloading => "Downloading",
            Status.Done => "Done",
            Status.Error => "Failed",
            _ => status.Data,
        };
        if (status.Progress is >= 0 and <= 100)
        {
            label = $"{label} {(int)status.Progress.Value}%";
        }
        return string.IsNullOrEmpty(status.Track) ? label : $"{label}: {status.Track}";
    }

    private async void OnDownloadClick(object sender, RoutedEventArgs e)
    {
        if (!await DownloadQueueService.EnsureEnabledAsync())
        {
            _ = LoadModeAsync();
            return;
        }
        DownloadButton.IsEnabled = false;
        try
        {
            await App.Services.Api.DownloadMusicAsync();
        }
        catch (Exception ex)
        {
            StatusText.Text = DescribeStatus(new DownloadStatusDto(Status.Error, ex.Message));
            ToastService.ShowError($"Download failed: {ex.Message}");
        }
        finally
        {
            RenderMode();
        }
    }

    private async void OnRemoveClick(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement { Tag: DownloadQueueItem item })
        {
            return;
        }
        var entry = EntryFormat.Build(item.Source, item.Type, item.Id);
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
        ToastService.ShowInfo("Link copied to clipboard");
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
