using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class DownloadsPage : UserControl
{
    private string[] _queue = [];
    private DownloadQueueItem[] _items = [];

    public DownloadsPage()
    {
        InitializeComponent();
        AttachedToVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected += OnRpcConnected;
            App.Services.Events.DownloadStatusChanged += OnStatusChanged;
            if (App.Services.Rpc.IsConnected)
            {
                _ = LoadAsync();
            }
        };
        DetachedFromVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected -= OnRpcConnected;
            App.Services.Events.DownloadStatusChanged -= OnStatusChanged;
        };
    }

    private void OnRpcConnected() => Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = LoadAsync());

    private void OnStatusChanged(DownloadStatusDto status) =>
        Avalonia.Threading.Dispatcher.UIThread.Post(() => RenderStatus(status));

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

            _items = items.ToArray();
            EmptyText.IsVisible = _items.Length == 0;
            ClearButton.IsEnabled = _items.Length > 0;
            RenderItems();
        }
        catch (Exception ex)
        {
            AppLog.Write("downloads", $"load failed: {ex.Message}");
        }
    }

    private void RenderItems()
    {
        QueuePanel.Children.Clear();
        foreach (var item in _items)
        {
            QueuePanel.Children.Add(BuildDownloadItem(item));
        }
    }

    private Control BuildDownloadItem(DownloadQueueItem item)
    {
        var thumb = new Image { Width = 64, Height = 64, Stretch = Stretch.UniformToFill };
        _ = ImageHelper.LoadAsync(thumb, item.Thumbnail);
        var thumbBorder = new Border
        {
            Width = 64, Height = 64,
            CornerRadius = new CornerRadius(6),
            ClipToBounds = true,
            Child = thumb,
        };

        var nameBlock = new TextBlock
        {
            Text = item.Name, FontSize = 15, FontWeight = FontWeight.SemiBold,
            TextTrimming = TextTrimming.CharacterEllipsis,
        };
        var modeBlock = new TextBlock
        {
            Text = item.ModeLabel, FontSize = 12, Opacity = 0.7,
        };
        var subtitleBlock = new TextBlock
        {
            Text = item.Subtitle, FontSize = 12, Opacity = 0.7,
            TextTrimming = TextTrimming.CharacterEllipsis,
        };
        var infoPanel = new StackPanel
        {
            Spacing = 2,
            VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center,
            Children =
            {
                nameBlock,
                new StackPanel
                {
                    Orientation = Avalonia.Layout.Orientation.Horizontal,
                    Spacing = 6,
                    Children = { modeBlock, subtitleBlock }
                }
            }
        };

        var removeBtn = new Button
        {
            Content = "\uE711",
            FontFamily = new FontFamily("Segoe MDL2 Assets"),
            FontSize = 12, Opacity = 0.7,
            Background = Brushes.Transparent,
            Padding = new Thickness(6),
            Tag = item,
        };
        removeBtn.Click += OnRemoveClick;

        var copyBtn = new Button
        {
            Content = "\uE8C8",
            FontFamily = new FontFamily("Segoe MDL2 Assets"),
            FontSize = 14, Opacity = 0.7,
            Background = Brushes.Transparent,
            Padding = new Thickness(6),
            Tag = item,
        };
        copyBtn.Click += OnCopyClick;

        var mainGrid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("Auto,64,*,Auto"),
            Children = { removeBtn, thumbBorder, infoPanel, copyBtn }
        };
        Grid.SetColumn(thumbBorder, 1);
        Grid.SetColumn(infoPanel, 2);
        Grid.SetColumn(copyBtn, 3);

        var stack = new StackPanel { Children = { mainGrid } };

        if (item.Tracks.Length > 0)
        {
            foreach (var track in item.Tracks)
            {
                var trackThumb = new Image { Width = 48, Height = 48, Stretch = Stretch.UniformToFill };
                _ = ImageHelper.LoadAsync(trackThumb, track.Thumbnail);

                var trackInfoPanel = new StackPanel
                {
                    VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center,
                    Spacing = 2,
                    Margin = new Thickness(12, 0),
                    Children =
                    {
                        new TextBlock { Text = track.Title, FontSize = 13, FontWeight = FontWeight.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis },
                        new TextBlock { Text = track.Artist, FontSize = 12, Opacity = 0.7, TextTrimming = TextTrimming.CharacterEllipsis },
                    }
                };
                var trackDurationBlock = new TextBlock
                {
                    Text = track.DurationText, FontSize = 12, Opacity = 0.7,
                    VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center,
                };

                var trackGrid = new Grid
                {
                    ColumnDefinitions = new ColumnDefinitions("48,*,Auto"),
                    Margin = new Thickness(64, 4, 0, 4),
                    Children =
                    {
                        new Border
                        {
                            Width = 48, Height = 48,
                            CornerRadius = new CornerRadius(6),
                            ClipToBounds = true,
                            Child = trackThumb,
                        },
                        trackInfoPanel,
                        trackDurationBlock,
                    }
                };
                Grid.SetColumn(trackInfoPanel, 1);
                Grid.SetColumn(trackDurationBlock, 2);
                stack.Children.Add(trackGrid);
            }
        }

        var container = new Border
        {
            Padding = new Thickness(12, 8),
            Background = ResourceHelper.FindBrush("CardBackgroundFillColorDefaultBrush"),
            CornerRadius = new CornerRadius(8),
            Child = stack,
        };

        return container;
    }

    private void RenderStatus(DownloadStatusDto status)
    {
        StatusText.Text = string.IsNullOrEmpty(status.Track) ? status.Data : $"{status.Data}: {status.Track}";
        var busy = status.Data == Status.Downloading || status.Data == Status.Prepare;
        Progress.IsVisible = busy;
        DownloadButton.IsEnabled = !busy;
    }

    private async void OnDownloadClick(object? sender, RoutedEventArgs e)
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

    private async void OnRemoveClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: DownloadQueueItem item })
        {
            return;
        }
        var entry = $"{item.Source}:{item.Type}:{item.Id}";
        var remaining = _queue.Where(q => q != entry).ToArray();
        _queue = remaining;
        await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, remaining);
        await LoadAsync();
    }

    private void OnCopyClick(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: DownloadQueueItem item })
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

    private async void OnClearClick(object? sender, RoutedEventArgs e)
    {
        if (await DialogService.ConfirmAsync("Clear queue", "Clear the entire download queue?"))
        {
            _queue = [];
            await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, Array.Empty<string>());
            await LoadAsync();
        }
    }
}