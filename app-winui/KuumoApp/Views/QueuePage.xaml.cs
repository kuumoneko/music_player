using System.Text.Json;
using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;

namespace KuumoApp.Views;

public sealed partial class QueuePage : Page
{
    private string[] _playQueue = [];
    private string _nextfrom = "";

    public QueuePage()
    {
        InitializeComponent();
        ItemMenu.AttachMoreButton(QueueList, RemoveFromQueue);
        ItemMenu.AttachMoreButton(UpcomingList, AddToUpcomingFrom);
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        App.Services.Rpc.Connected += OnRpcConnected;
        App.Services.Events.QueueChanged += OnQueueChanged;
        if (App.Services.Rpc.IsConnected)
        {
            _ = LoadAsync();
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        App.Services.Rpc.Connected -= OnRpcConnected;
        App.Services.Events.QueueChanged -= OnQueueChanged;
    }

    private void OnRpcConnected() => DispatcherQueue.TryEnqueue(() => _ = LoadAsync());

    private void OnQueueChanged(QueueChangedDto data)
    {
        _playQueue = data.PlayQueue ?? [];
        _nextfrom = data.Nextfrom ?? "";
        _ = LoadAsync();
    }

    private async Task LoadAsync()
    {
        try
        {
            if (!string.IsNullOrEmpty(_nextfrom))
            {
                if (!EntryFormat.TryParse(_nextfrom, out var source, out var type, out var id))
                {
                    FromText.Visibility = Visibility.Collapsed;
                    UpcomingList.ItemsSource = null;
                    UpcomingTitle.Visibility = Visibility.Collapsed;
                }
                else
                {
                    var data = await App.Services.Api.GetMusicDataAsync(source, type, id);
                    if (data is JsonElement el && el.ValueKind == JsonValueKind.Object)
                    {
                        var title = "";
                        var upcoming = new List<TrackRow>();
                        if (type == MusicType.Track)
                        {
                            var track = JsonSerializer.Deserialize<TrackDto>(el, RpcClient.Json);
                            if (track is not null)
                            {
                                title = track.Name;
                                upcoming.Add(TrackRow.FromTrack(track));
                            }
                        }
                        else
                        {
                            var name = el.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : "";
                            title = name ?? "";
                            var tracks = new List<TrackDto>();
                            if (el.TryGetProperty("tracks", out var tracksEl) && tracksEl.ValueKind == JsonValueKind.Array)
                            {
                                tracks.AddRange(tracksEl.EnumerateArray()
                                    .Select(t => JsonSerializer.Deserialize<TrackDto>(t, RpcClient.Json))
                                    .Where(t => t is not null)
                                    .Cast<TrackDto>());
                            }
                            upcoming.AddRange(tracks.Take(100).Select(TrackRow.FromTrack));
                        }
                        FromText.Text = $"From: {title}";
                        FromText.Visibility = Visibility.Visible;
                        UpcomingList.ItemsSource = upcoming.ToArray();
                        UpcomingTitle.Visibility = upcoming.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
                    }
                    else
                    {
                        FromText.Visibility = Visibility.Collapsed;
                        UpcomingList.ItemsSource = null;
                        UpcomingTitle.Visibility = Visibility.Collapsed;
                    }
                }
            }
            else
            {
                FromText.Visibility = Visibility.Collapsed;
                UpcomingList.ItemsSource = null;
                UpcomingTitle.Visibility = Visibility.Collapsed;
            }

            var queueRows = new List<TrackRow>();
            if (_playQueue.Length > 0)
            {
                var items = await App.Services.Api.GetQueueDataAsync(_playQueue);
                if (items is not null)
                {
                    for (var i = 0; i < items.Length && i < _playQueue.Length; i++)
                    {
                        if (items[i] is not JsonElement el || el.ValueKind != JsonValueKind.Object)
                        {
                            continue;
                        }
                        if (el.TryGetProperty("name", out _))
                        {
                            var track = JsonSerializer.Deserialize<TrackDto>(el, RpcClient.Json);
                            if (track is not null)
                            {
                                queueRows.Add(TrackRow.FromTrack(track));
                            }
                        }
                        else
                        {
                            if (!EntryFormat.TryParse(_playQueue[i], out _, out var kind, out _))
                            {
                                continue;
                            }
                            if (kind == MusicType.Playlist)
                            {
                                var playlist = JsonSerializer.Deserialize<PlaylistDto>(el, RpcClient.Json);
                                if (playlist is not null)
                                {
                                    queueRows.Add(new TrackRow(MusicSource.Youtube, MusicType.Playlist, playlist.Id, playlist.Name, "Playlist", playlist.Thumbnail, ""));
                                }
                            }
                            else if (kind == MusicType.Artist)
                            {
                                var artist = JsonSerializer.Deserialize<ArtistDto>(el, RpcClient.Json);
                                if (artist is not null)
                                {
                                    queueRows.Add(new TrackRow(MusicSource.Youtube, MusicType.Artist, artist.Id, artist.Name, "Artist", artist.Thumbnail, ""));
                                }
                            }
                        }
                    }
                }
            }
            QueueList.ItemsSource = queueRows.ToArray();
            QueueSectionTitle.Visibility = queueRows.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
            QueueTitle.Text = $"Play queue ({_playQueue.Length})";

            var hasUpcoming = UpcomingList.ItemsSource is TrackRow[] { Length: > 0 };
            var total = queueRows.Count + (hasUpcoming ? UpcomingList.ItemsSource is TrackRow[] u ? u.Length : 0 : 0);
            EmptyText.Visibility = total == 0 ? Visibility.Visible : Visibility.Collapsed;
        }
        catch (Exception ex)
        {
            AppLog.Write("queue", $"load failed: {ex.Message}");
        }
    }

    private void RemoveFromQueue(TrackRow row)
    {
        var entry = EntryFormat.Build(row.Source, row.Type, row.Id);
        var remaining = _playQueue
            .Where(e => e != entry && !e.EndsWith($":{row.Id}"))
            .ToArray();
        if (remaining.Length != _playQueue.Length)
        {
            _ = App.Services.Api.SetUserDataAsync(UserDataKeys.PlayQueue, remaining);
        }
    }

    private void AddToUpcomingFrom(TrackRow row)
    {
        var (source, type, id) = QueueContext();
        if (type == MusicType.Track)
        {
            RemoveFromQueue(row);
        }
        else
        {
            _ = App.Services.Api.AddToBatchQueueAsync(source, type, id);
        }
    }

    private (string Source, string Type, string Id) QueueContext()
    {
        if (EntryFormat.TryParse(_nextfrom, out var source, out var type, out var id))
        {
            return (source, type, id);
        }
        return (MusicSource.Youtube, MusicType.Track, "");
    }

    private async void OnQueueItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is TrackRow row)
        {
            var (source, type, id) = QueueContext();
            (string Source, string Type, string Id) ctx = type == MusicType.Track ? (row.Source, row.Type, row.Id) : (source, type, id);
            await Playback.PlayEntryAsync(EntryFormat.Build(ctx.Source, ctx.Type, ctx.Id), row.Payload);
        }
    }

    private async void OnUpcomingItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is TrackRow row)
        {
            var (source, type, id) = QueueContext();
            (string Source, string Type, string Id) ctx = type == MusicType.Track ? (row.Source, row.Type, row.Id) : (source, type, id);
            await Playback.PlayTrackAsync(row.Payload!, ctx.Source, ctx.Type, ctx.Id);
        }
    }

    private async void OnQueueRightTapped(object sender, RightTappedRoutedEventArgs e)
    {
        if (FindRow(e.OriginalSource) is TrackRow row)
        {
            var flyout = await ItemMenu.BuildAsync(row, RemoveFromQueue);
            ItemMenu.Show(flyout, (FrameworkElement)e.OriginalSource, e.GetPosition((FrameworkElement)e.OriginalSource));
        }
    }

    private async void OnUpcomingRightTapped(object sender, RightTappedRoutedEventArgs e)
    {
        if (FindRow(e.OriginalSource) is TrackRow row)
        {
            var flyout = await ItemMenu.BuildAsync(row, AddToUpcomingFrom);
            ItemMenu.Show(flyout, (FrameworkElement)e.OriginalSource, e.GetPosition((FrameworkElement)e.OriginalSource));
        }
    }

    private static TrackRow? FindRow(object originalSource)
    {
        if (originalSource is not FrameworkElement element)
        {
            return null;
        }
        var current = element;
        while (current is not null)
        {
            if (current.DataContext is TrackRow row)
            {
                return row;
            }
            current = current.Parent as FrameworkElement;
        }
        return null;
    }

    private async Task<bool> ConfirmAsync(string title, string message)
    {
        var dialog = new ContentDialog
        {
            Title = title,
            Content = message,
            PrimaryButtonText = "Yes",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close,
            XamlRoot = XamlRoot,
        };
        return await dialog.ShowAsync() == ContentDialogResult.Primary;
    }

    private async void OnClearQueueClick(object sender, RoutedEventArgs e)
    {
        if (await ConfirmAsync("Clear queue", "Clear the entire play queue?"))
        {
            await App.Services.Api.SetUserDataAsync(UserDataKeys.PlayQueue, Array.Empty<string>());
        }
    }

    private async void OnClearNextfromClick(object sender, RoutedEventArgs e)
    {
        if (await ConfirmAsync("Clear next from", "Clear upcoming tracks from queue?"))
        {
            await App.Services.Api.SetUserDataAsync(UserDataKeys.Nextfrom, "");
        }
    }
}
