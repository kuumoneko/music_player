using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class DetailPage : UserControl
{
    private DetailNav? _nav;
    private string _entry = "";
    private TrackRow[] _tracks = [];
    private bool IsLocalPlaylist => _nav is { Source: MusicSource.Local, Type: MusicType.Playlist };

    private readonly Button _playAllButton;
    private readonly Button _refreshButton;
    private readonly Button _deleteButton;
    private readonly Button _pinButton;
    private readonly Button _shareButton;
    private readonly Button _downloadButton;

    public DetailPage()
    {
        InitializeComponent();
        _playAllButton = new Button
        {
            Content = "Play all",
            Background = ResourceHelper.FindBrush("AppAccentBrush"),
            Foreground = ResourceHelper.FindBrush("AppAccentTextBrush"),
            BorderThickness = new Thickness(0),
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(16, 8),
            FontWeight = FontWeight.SemiBold,
        };
        _playAllButton.Click += OnPlayAllClick;
        _refreshButton = new Button { Content = "Refresh" };
        _refreshButton.Click += OnRefreshClick;
        _deleteButton = new Button { Content = "Delete" };
        _deleteButton.Click += OnDeleteClick;
        _pinButton = new Button
        {
            Content = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                Spacing = 4,
                Children =
                {
                    new TextBlock { Text = "\uE718", FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 14, VerticalAlignment = VerticalAlignment.Center },
                    new TextBlock { Text = "Pin", VerticalAlignment = VerticalAlignment.Center },
                }
            }
        };
        _pinButton.Click += OnPinClick;
        _shareButton = new Button { Content = "Copy link" };
        _shareButton.Click += OnShareClick;
        _downloadButton = new Button { Content = "Download" };
        _downloadButton.Click += OnDownloadClick;
    }

    public void LoadNav(DetailNav nav)
    {
        _nav = nav;
        _ = LoadAsync();
    }

    private async Task LoadAsync()
    {
        if (_nav is null) return;
        TrackPanel.Children.Clear();
        _playAllButton.IsVisible = false;
        HeaderTitle.Text = "Loading...";
        ErrorText.IsVisible = false;
        try
        {
            var data = await App.Services.Api.GetMusicDataAsync(_nav.Source, _nav.Type, _nav.Id);
            if (data is null)
            {
                ErrorText.Text = "Not found";
                ErrorText.IsVisible = true;
                HeaderTitle.Text = "Not found";
                ShellPage.SetTitle(null);
                return;
            }
            var kind = _nav.Type;
            if (kind == MusicType.Track)
            {
                var track = JsonSerializer.Deserialize<TrackDto>(data!.Value, RpcClient.Json);
                if (track is null) return;
                HeaderKind.Text = "Track";
                HeaderTitle.Text = track.Name;
                ShellPage.SetTitle(track.Name);
                HeaderSubtitle.Text = string.Join(", ", track.Artist.Select(a => a.Name));
                _ = ImageHelper.LoadAsync(HeaderThumb, track.Thumbnail);
                _entry = $"{_nav.Source}:{MusicType.Track}:{track.Id}";
                _tracks = new[] { TrackRow.FromTrack(track) };
                RenderTracks();
                _playAllButton.IsVisible = true;
            }
            else if (kind == MusicType.Playlist)
            {
                var playlist = JsonSerializer.Deserialize<PlaylistDto>(data!.Value, RpcClient.Json);
                if (playlist is null) return;
                HeaderKind.Text = "Playlist";
                HeaderTitle.Text = playlist.Name;
                ShellPage.SetTitle(playlist.Name);
                HeaderSubtitle.Text = $"{playlist.Tracks?.Length ?? 0} tracks";
                _ = ImageHelper.LoadAsync(HeaderThumb, playlist.Thumbnail);
                _entry = $"{_nav.Source}:{MusicType.Playlist}:{playlist.Id}";
                var tracks = playlist.Tracks ?? [];
                if (tracks.Length == 0 && playlist.Ids is { Length: > 0 } ids)
                {
                    var resolved = await App.Services.Api.GetQueueDataAsync(ids);
                    tracks = resolved?.Where(r => r is not null).Select(r => JsonSerializer.Deserialize<TrackDto>(r!.Value, RpcClient.Json)).Where(t => t is not null).Cast<TrackDto>().ToArray() ?? [];
                }
                _tracks = tracks.Select(TrackRow.FromTrack).ToArray();
                RenderTracks();
                _playAllButton.IsVisible = _tracks.Length > 0;
            }
            else if (kind == MusicType.Artist)
            {
                var artist = JsonSerializer.Deserialize<ArtistDto>(data!.Value, RpcClient.Json);
                if (artist is null) return;
                HeaderKind.Text = "Artist";
                HeaderTitle.Text = artist.Name;
                ShellPage.SetTitle(artist.Name);
                HeaderSubtitle.Text = "Artist";
                _ = ImageHelper.LoadAsync(HeaderThumb, artist.Thumbnail);
                _entry = $"{_nav.Source}:{MusicType.Artist}:{artist.Id}";
                _tracks = (artist.Tracks ?? []).Select(TrackRow.FromTrack).ToArray();
                RenderTracks();
                _playAllButton.IsVisible = artist.Tracks is { Length: > 0 };
            }

            _refreshButton.IsVisible = _nav.Source != MusicSource.Local && kind != MusicType.Track;
            _deleteButton.IsVisible = _nav.Source == MusicSource.Local && kind == MusicType.Playlist;
            _pinButton.IsVisible = !_deleteButton.IsVisible;
            _shareButton.IsVisible = _nav.Source == MusicSource.Youtube;
            _downloadButton.IsVisible = _nav.Source == MusicSource.Youtube;
            TrackCountText.Text = _tracks.Length > 0 ? $"{_tracks.Length} tracks" : "";
            await UpdatePinStateAsync();
            RebuildButtons();
        }
        catch (Exception ex)
        {
            AppLog.Write("detail", $"load failed: {ex.ToString()}");
            ErrorText.Text = ex.Message;
            ErrorText.IsVisible = true;
            ShellPage.SetTitle(null);
        }
    }

    private void RenderTracks()
    {
        TrackPanel.Children.Clear();
        foreach (var row in _tracks)
        {
            TrackPanel.Children.Add(BuildTrackItem(row));
        }
    }

    private Control BuildTrackItem(TrackRow row)
    {
        var thumb = new Image { Width = 64, Height = 64, Stretch = Stretch.UniformToFill };
        _ = ImageHelper.LoadAsync(thumb, row.Thumbnail);

        var titleBlock = new TextBlock { Text = row.Title, FontWeight = FontWeight.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis };
        var artistBlock = new TextBlock { Text = row.Artist, FontSize = 12, Opacity = 0.7, TextTrimming = TextTrimming.CharacterEllipsis };
        var durationBlock = new TextBlock { Text = row.DurationText, FontSize = 12, Opacity = 0.7, VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center };

        var infoPanel = new StackPanel { Spacing = 2, Margin = new Thickness(8, 0), Children = { titleBlock, artistBlock } };

        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("64,*,Auto"),
            Margin = new Thickness(0, 4),
            Children =
            {
                new Border { Width = 64, Height = 64, CornerRadius = new CornerRadius(6), ClipToBounds = true, Child = thumb },
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
                var track = target.Payload ?? new TrackDto(target.Title, target.Id, [new TrackArtistDto("", target.Artist)], target.Source, target.Thumbnail, 0, "");
                var context = _nav is { Type: not null } && _nav.Type != MusicType.Track
                    ? (_nav.Source, _nav.Type, _nav.Id)
                    : (target.Source, target.Type, target.Id);
                await Playback.PlayTrackAsync(track, context.Source, context.Type, context.Id);
            }
            else if (e.GetCurrentPoint(container).Properties.IsRightButtonPressed)
            {
                var menu = ItemMenu.Build(target, IsLocalPlaylist ? LocalRemoveAction : null, "Remove from playlist", _nav);
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

    private void LocalRemoveAction(TrackRow row)
    {
        if (_nav is null) return;
        _ = RemoveFromPlaylistAsync(row.Id);
    }

    private async Task RemoveFromPlaylistAsync(string trackId)
    {
        try
        {
            await App.Services.Api.RemoveFromPlaylistAsync(_nav!.Id, trackId);
            await LoadAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("detail", $"remove from playlist failed: {ex.Message}");
        }
    }

    private void RebuildButtons()
    {
        ButtonPanel.Children.Clear();
        if (_playAllButton.IsVisible) ButtonPanel.Children.Add(_playAllButton);
        if (_refreshButton.IsVisible) ButtonPanel.Children.Add(_refreshButton);
        if (_deleteButton.IsVisible) ButtonPanel.Children.Add(_deleteButton);
        if (_pinButton.IsVisible) ButtonPanel.Children.Add(_pinButton);
        if (_shareButton.IsVisible) ButtonPanel.Children.Add(_shareButton);
        if (_downloadButton.IsVisible) ButtonPanel.Children.Add(_downloadButton);
    }

    private async void OnPlayAllClick(object? sender, RoutedEventArgs e)
    {
        if (_tracks.Length == 0) return;
        var shuffle = await App.Services.Api.GetUserDataAsync<int>(UserDataKeys.Shuffle);
        var first = shuffle == (int)Shuffle.Enable
            ? _tracks[Random.Shared.Next(_tracks.Length)].Payload
            : _tracks[0].Payload;
        if (first is not null)
        {
            await Playback.PlayTrackAsync(first, _nav?.Source, _nav?.Type, _nav?.Id);
        }
    }

    private async Task UpdatePinStateAsync()
    {
        if (_nav is null) return;
        var isPinned = await new PinService().IsPinnedAsync(_nav.Source, _nav.Type, _nav.Id);
        if (_pinButton.Content is StackPanel sp && sp.Children.Count >= 2)
        {
            var glyph = sp.Children[0] as TextBlock;
            var label = sp.Children[1] as TextBlock;
            if (glyph is not null) glyph.Text = isPinned ? "\uE840" : "\uE718";
            if (label is not null) label.Text = isPinned ? "Unpin" : "Pin";
        }
    }

    private async void OnPinClick(object? sender, RoutedEventArgs e)
    {
        if (_nav is null) return;
        await new PinService().TogglePinAsync(_nav.Source, _nav.Type, _nav.Id);
        await UpdatePinStateAsync();
    }

    private void OnShareClick(object? sender, RoutedEventArgs e)
    {
        if (_nav is null || _nav.Source != MusicSource.Youtube) return;
        if (_nav.Type == MusicType.Playlist)
            ClipboardService.CopyPlaylist(_nav.Id);
        else if (_nav.Type == MusicType.Artist)
            ClipboardService.CopyArtist(_nav.Id);
        else
            ClipboardService.CopyTrack(_nav.Source, _nav.Id);
    }

    private async void OnDownloadClick(object? sender, RoutedEventArgs e)
    {
        if (_nav is null || _nav.Source != MusicSource.Youtube) return;
        await new DownloadQueueService().AddAsync(_nav.Source, _nav.Type, _nav.Id);
    }

    private async void OnRefreshClick(object? sender, RoutedEventArgs e)
    {
        if (_nav is null) return;
        _refreshButton.IsEnabled = false;
        try
        {
            if (_nav.Type == MusicType.Playlist)
                await App.Services.Api.RefreshPlaylistAsync(_nav.Id);
            else if (_nav.Type == MusicType.Artist)
                await App.Services.Api.RefreshArtistAsync(_nav.Id);
            await LoadAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("detail", $"refresh failed: {ex.Message}");
        }
        finally
        {
            _refreshButton.IsEnabled = true;
        }
    }

    private async void OnDeleteClick(object? sender, RoutedEventArgs e)
    {
        if (_nav is null) return;
        if (!await DialogService.ConfirmAsync("Delete playlist", "Delete this playlist?")) return;
        try
        {
            await App.Services.Api.DeletePlaylistAsync(_nav.Id);
            ShellPage.Instance?.GoBack();
        }
        catch (Exception ex)
        {
            AppLog.Write("detail", $"delete failed: {ex.Message}");
        }
    }
}