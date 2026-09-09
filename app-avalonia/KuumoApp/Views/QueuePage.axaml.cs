using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class QueuePage : UserControl
{
    private string[] _playQueue = [];
    private string _nextfrom = "";
    private TrackRow[] _queueRows = [];
    private TrackRow[] _upcomingRows = [];

    public QueuePage()
    {
        InitializeComponent();
        AttachedToVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected += OnRpcConnected;
            App.Services.Events.QueueChanged += OnQueueChanged;
            if (App.Services.Rpc.IsConnected)
            {
                _ = LoadAsync();
            }
        };
        DetachedFromVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected -= OnRpcConnected;
            App.Services.Events.QueueChanged -= OnQueueChanged;
        };
    }

    private void OnRpcConnected() => Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = LoadAsync());

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
                var parts = _nextfrom.Split(':');
                var source = parts.Length > 0 ? parts[0] : MusicSource.Youtube;
                var type = parts.Length > 1 ? parts[1] : MusicType.Track;
                var id = parts.Length > 2 ? parts[2] : (parts.Length > 1 ? parts[1] : "");
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
                    FromText.IsVisible = true;
                    _upcomingRows = upcoming.ToArray();
                }
                else
                {
                    FromText.IsVisible = false;
                    _upcomingRows = [];
                }
            }
            else
            {
                FromText.IsVisible = false;
                _upcomingRows = [];
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
                            var parts = _playQueue[i].Split(':');
                            var kind = parts.Length > 1 ? parts[1] : MusicType.Track;
                            if (kind == MusicType.Playlist)
                            {
                                var playlist = JsonSerializer.Deserialize<PlaylistDto>(el, RpcClient.Json);
                                if (playlist is not null)
                                {
                                    queueRows.Add(new TrackRow { Source = MusicSource.Youtube, Type = MusicType.Playlist, Id = playlist.Id, Title = playlist.Name, Artist = "Playlist", Thumbnail = playlist.Thumbnail });
                                }
                            }
                            else if (kind == MusicType.Artist)
                            {
                                var artist = JsonSerializer.Deserialize<ArtistDto>(el, RpcClient.Json);
                                if (artist is not null)
                                {
                                    queueRows.Add(new TrackRow { Source = MusicSource.Youtube, Type = MusicType.Artist, Id = artist.Id, Title = artist.Name, Artist = "Artist", Thumbnail = artist.Thumbnail });
                                }
                            }
                        }
                    }
                }
            }
            _queueRows = queueRows.ToArray();
            QueueSectionTitle.IsVisible = _queueRows.Length > 0;
            QueueTitle.Text = $"Play queue ({_playQueue.Length})";

            var total = _queueRows.Length + _upcomingRows.Length;
            EmptyText.IsVisible = total == 0;

            RenderAll();
        }
        catch (Exception ex)
        {
            AppLog.Write("queue", $"load failed: {ex.Message}");
        }
    }

    private void RenderAll()
    {
        ContentPanel.Children.Clear();
        foreach (var row in _queueRows)
        {
            ContentPanel.Children.Add(BuildTrackItem(row, RemoveFromQueue, isUpcoming: false));
        }
        if (_upcomingRows.Length > 0)
        {
            var header = new TextBlock
            {
                Text = "Upcoming",
                FontSize = 16, FontWeight = FontWeight.SemiBold,
                Opacity = 0.8,
                Margin = new Thickness(0, 16, 0, 4),
            };
            ContentPanel.Children.Add(header);
            foreach (var row in _upcomingRows)
            {
                ContentPanel.Children.Add(BuildTrackItem(row, AddToUpcomingFrom, isUpcoming: true));
            }
        }
    }

    private Control BuildTrackItem(TrackRow row, Action<TrackRow> extraAction, bool isUpcoming)
    {
        var thumb = new Image { Width = 64, Height = 64, Stretch = Stretch.UniformToFill };
        _ = ImageHelper.LoadAsync(thumb, row.Thumbnail);

        var titleBlock = new TextBlock
        {
            Text = row.Title,
            FontWeight = FontWeight.SemiBold,
            TextTrimming = TextTrimming.CharacterEllipsis,
        };
        var artistBlock = new TextBlock
        {
            Text = row.Artist,
            FontSize = 12, Opacity = 0.7,
            TextTrimming = TextTrimming.CharacterEllipsis,
        };
        var durationBlock = new TextBlock
        {
            Text = row.DurationText,
            FontSize = 12, Opacity = 0.7,
            VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center,
        };

        var infoPanel = new StackPanel { Spacing = 2, Margin = new Thickness(8, 0), Children = { titleBlock, artistBlock } };

        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("64,*,Auto"),
            Margin = new Thickness(0, 4),
            Children =
            {
                new Border
                {
                    Width = 64, Height = 64,
                    CornerRadius = new CornerRadius(6),
                    ClipToBounds = true,
                    Child = thumb,
                },
                infoPanel,
                durationBlock,
            }
        };
        Grid.SetColumn(infoPanel, 1);
        Grid.SetColumn(durationBlock, 2);

        var container = new Border
        {
            Background = Brushes.Transparent,
            Child = grid,
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(4),
        };

        var target = row;
        container.PointerPressed += async (_, e) =>
        {
            if (e.GetCurrentPoint(container).Properties.IsLeftButtonPressed)
            {
                if (isUpcoming)
                {
                    var (source, type, id) = QueueContext();
                    (string Source, string Type, string Id) ctx = type == MusicType.Track ? (target.Source, target.Type, target.Id) : (source, type, id);
                    await Playback.PlayTrackAsync(target.Payload!, ctx.Source, ctx.Type, ctx.Id);
                }
                else
                {
                    var (source, type, id) = QueueContext();
                    (string Source, string Type, string Id) ctx = type == MusicType.Track ? (target.Source, target.Type, target.Id) : (source, type, id);
                    await Playback.PlayEntryAsync($"{ctx.Source}:{ctx.Type}:{ctx.Id}", target.Payload);
                }
            }
            else if (e.GetCurrentPoint(container).Properties.IsRightButtonPressed)
            {
                var menu = ItemMenu.Build(target, extraAction);
                menu.Open(container);
            }
        };
        container.PointerEntered += (_, _) =>
        {
            container.Background = ResourceHelper.FindBrush("CardBackgroundFillColorSecondaryBrush")
                                  ?? new SolidColorBrush(Colors.Gray) { Opacity = 0.1 };
        };
        container.PointerExited += (_, _) => container.Background = Brushes.Transparent;

        return container;
    }

    private void RemoveFromQueue(TrackRow row)
    {
        var entry = $"{row.Source}:{row.Type}:{row.Id}";
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
        var parts = _nextfrom.Split(':');
        var source = parts.Length > 0 ? parts[0] : MusicSource.Youtube;
        var type = parts.Length > 1 ? parts[1] : MusicType.Track;
        var id = parts.Length > 2 ? parts[2] : (parts.Length > 1 ? parts[1] : "");
        return (source, type, id);
    }

    private async void OnClearQueueClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
    {
        if (await DialogService.ConfirmAsync("Clear queue", "Clear the entire play queue?"))
        {
            await App.Services.Api.SetUserDataAsync(UserDataKeys.PlayQueue, Array.Empty<string>());
        }
    }

    private async void OnClearNextfromClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
    {
        if (await DialogService.ConfirmAsync("Clear next from", "Clear upcoming tracks from queue?"))
        {
            await App.Services.Api.SetUserDataAsync(UserDataKeys.Nextfrom, "");
        }
    }
}