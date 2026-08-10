using System.Text.Json;
using KuumoApp.Models;
using KuumoApp.Controls;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;

namespace KuumoApp.Views;

public record DetailNav(string Source, string Type, string Id);

public sealed partial class DetailPage : Page
{
    private DetailNav? _nav;
    private string _entry = "";

    public DetailPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        if (e.Parameter is DetailNav nav)
        {
            _nav = nav;
            if (!_menuAttached)
            {
                _menuAttached = true;
                var navContext = _nav is { Type: not null } && _nav.Type != MusicType.Track ? _nav : null;
                ItemMenu.AttachMoreButton(TrackList, LocalRemoveAction, "Remove from playlist", navContext);
            }
            await LoadAsync();
        }
    }

    private bool _menuAttached;
    private bool IsLocalPlaylist => _nav is { Source: MusicSource.Local, Type: MusicType.Playlist };

    private void LocalRemoveAction(TrackRow row)
    {
        if (_nav is null)
        {
            return;
        }
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

    private async Task LoadAsync()
    {
        if (_nav is null)
        {
            return;
        }
        TrackList.ItemsSource = null;
        PlayAllButton.Visibility = Visibility.Collapsed;
        HeaderTitle.Text = "Loading...";
        ErrorText.Visibility = Visibility.Collapsed;
        try
        {
            var data = await App.Services.Api.GetMusicDataAsync(_nav.Source, _nav.Type, _nav.Id);
            if (data is null)
            {
                ErrorText.Text = "Not found";
                ErrorText.Visibility = Visibility.Visible;
                HeaderTitle.Text = "Not found";
                ShellPage.SetTitle(null);
                return;
            }
            var kind = _nav.Type;
            if (kind == MusicType.Track)
            {
                var track = JsonSerializer.Deserialize<TrackDto>(data!.Value, RpcClient.Json);
                if (track is null)
                {
                    return;
                }
                HeaderKind.Text = "Track";
                HeaderTitle.Text = track.Name;
                ShellPage.SetTitle(track.Name);
                HeaderSubtitle.Text = string.Join(", ", track.Artist.Select(a => a.Name));
                await ImageAttach.LoadAsync(HeaderThumb, track.Thumbnail);
                _entry = $"{_nav.Source}:{MusicType.Track}:{track.Id}";
                var row = TrackRow.FromTrack(track);
                TrackList.ItemsSource = new[] { row };
                PlayAllButton.Visibility = Visibility.Visible;
            }
            else if (kind == MusicType.Playlist)
            {
                var playlist = JsonSerializer.Deserialize<PlaylistDto>(data!.Value, RpcClient.Json);
                if (playlist is null)
                {
                    return;
                }
                HeaderKind.Text = "Playlist";
                HeaderTitle.Text = playlist.Name;
                ShellPage.SetTitle(playlist.Name);
                HeaderSubtitle.Text = $"{playlist.Tracks?.Length ?? 0} tracks";
                await ImageAttach.LoadAsync(HeaderThumb, playlist.Thumbnail);
                _entry = $"{_nav.Source}:{MusicType.Playlist}:{playlist.Id}";
                var tracks = playlist.Tracks ?? [];
                if (tracks.Length == 0 && playlist.Ids is { Length: > 0 } ids)
                {
                    var resolved = await App.Services.Api.GetQueueDataAsync(ids);
                    tracks = resolved?.Where(r => r is not null).Select(r => JsonSerializer.Deserialize<TrackDto>(r!.Value, RpcClient.Json)).Where(t => t is not null).Cast<TrackDto>().ToArray() ?? [];
                }
                PopulateTracks(tracks);
                PlayAllButton.Visibility = tracks.Length > 0 ? Visibility.Visible : Visibility.Collapsed;
            }
            else if (kind == MusicType.Artist)
            {
                var artist = JsonSerializer.Deserialize<ArtistDto>(data!.Value, RpcClient.Json);
                if (artist is null)
                {
                    return;
                }
                HeaderKind.Text = "Artist";
                HeaderTitle.Text = artist.Name;
                ShellPage.SetTitle(artist.Name);
                HeaderSubtitle.Text = "Artist";
                await ImageAttach.LoadAsync(HeaderThumb, artist.Thumbnail);
                _entry = $"{_nav.Source}:{MusicType.Artist}:{artist.Id}";
                PopulateTracks(artist.Tracks ?? []);
                PlayAllButton.Visibility = artist.Tracks is { Length: > 0 } ? Visibility.Visible : Visibility.Collapsed;
            }
            RefreshButton.Visibility = _nav.Source != MusicSource.Local && kind != MusicType.Track
                ? Visibility.Visible
                : Visibility.Collapsed;
            DeleteButton.Visibility = _nav.Source == MusicSource.Local && kind == MusicType.Playlist
                ? Visibility.Visible
                : Visibility.Collapsed;
            PinButton.Visibility = DeleteButton.Visibility == Visibility.Visible
                ? Visibility.Collapsed
                : Visibility.Visible;
            ShareButton.Visibility = _nav.Source == MusicSource.Youtube ? Visibility.Visible : Visibility.Collapsed;
            DownloadButton.Visibility = _nav.Source == MusicSource.Youtube ? Visibility.Visible : Visibility.Collapsed;
            await UpdatePinStateAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("detail", $"load failed: {ex.ToString()}");
            ErrorText.Text = ex.Message;
            ErrorText.Visibility = Visibility.Visible;
            ShellPage.SetTitle(null);
        }
    }

    private void PopulateTracks(TrackDto[] tracks)
    {
        TrackList.ItemsSource = tracks.Select(TrackRow.FromTrack).ToArray();
    }

    private async void OnTrackClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is TrackRow row)
        {
            var track = row.Payload ?? new TrackDto(row.Title, row.Id, [new TrackArtistDto("", row.Artist)], row.Source, row.Thumbnail, 0, "");
            var context = _nav is { Type: not null } && _nav.Type != MusicType.Track
                ? (_nav.Source, _nav.Type, _nav.Id)
                : (row.Source, row.Type, row.Id);
            await Playback.PlayTrackAsync(track, context.Source, context.Type, context.Id);
        }
    }

    private async void OnTrackRightTapped(object sender, RightTappedRoutedEventArgs e)
    {
        if (e.OriginalSource is not FrameworkElement element)
        {
            return;
        }
        var current = element;
        while (current is not null)
        {
            if (current.DataContext is TrackRow row)
            {
                var flyout = await ItemMenu.BuildAsync(row, IsLocalPlaylist ? LocalRemoveAction : null, "Remove from playlist");
                ItemMenu.Show(flyout, current, e.GetPosition(current));
                return;
            }
            current = current.Parent as FrameworkElement;
        }
    }

    private async void OnPlayAllClick(object sender, RoutedEventArgs e)
    {
        if (TrackList.ItemsSource is not TrackRow[] rows || rows.Length == 0)
        {
            return;
        }
        var shuffle = await App.Services.Api.GetUserDataAsync<int>(UserDataKeys.Shuffle);
        var first = shuffle == (int)Shuffle.Enable
            ? rows[Random.Shared.Next(rows.Length)].Payload
            : rows[0].Payload;
        if (first is not null)
        {
            await Playback.PlayTrackAsync(first, _nav?.Source, _nav?.Type, _nav?.Id);
        }
    }

    private async Task UpdatePinStateAsync()
    {
        if (_nav is null)
        {
            return;
        }
        var isPinned = await new PinService().IsPinnedAsync(_nav.Source, _nav.Type, _nav.Id);
        PinButton.Content = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 8,
            Children =
            {
                new FontIcon { Glyph = isPinned ? "\uE840" : "\uE718", FontSize = 14 },
                new TextBlock { Text = isPinned ? "Unpin" : "Pin" },
            },
        };
    }

    private async void OnPinClick(object sender, RoutedEventArgs e)
    {
        if (_nav is null)
        {
            return;
        }
        await new PinService().TogglePinAsync(_nav.Source, _nav.Type, _nav.Id);
        await UpdatePinStateAsync();
    }

    private void OnShareClick(object sender, RoutedEventArgs e)
    {
        if (_nav is null || _nav.Source != MusicSource.Youtube)
        {
            return;
        }
        if (_nav.Type == MusicType.Playlist)
        {
            ClipboardService.CopyPlaylist(_nav.Id);
        }
        else if (_nav.Type == MusicType.Artist)
        {
            ClipboardService.CopyArtist(_nav.Id);
        }
        else
        {
            ClipboardService.CopyTrack(_nav.Source, _nav.Id);
        }
    }

    private async void OnDownloadClick(object sender, RoutedEventArgs e)
    {
        if (_nav is null || _nav.Source != MusicSource.Youtube)
        {
            return;
        }
        await new DownloadQueueService().AddAsync(_nav.Source, _nav.Type, _nav.Id);
    }

    private async void OnRefreshClick(object sender, RoutedEventArgs e)
    {
        if (_nav is null)
        {
            return;
        }
        RefreshButton.IsEnabled = false;
        try
        {
            if (_nav.Type == MusicType.Playlist)
            {
                await App.Services.Api.RefreshPlaylistAsync(_nav.Id);
            }
            else if (_nav.Type == MusicType.Artist)
            {
                await App.Services.Api.RefreshArtistAsync(_nav.Id);
            }
            await LoadAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("detail", $"refresh failed: {ex.Message}");
        }
        finally
        {
            RefreshButton.IsEnabled = true;
        }
    }

    private async void OnDeleteClick(object sender, RoutedEventArgs e)
    {
        if (_nav is null)
        {
            return;
        }
        var dialog = new ContentDialog
        {
            Title = "Delete playlist",
            Content = "Delete this playlist?",
            PrimaryButtonText = "Delete",
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close,
            XamlRoot = XamlRoot,
        };
        if (await dialog.ShowAsync() != ContentDialogResult.Primary)
        {
            return;
        }
        try
        {
            await App.Services.Api.DeletePlaylistAsync(_nav.Id);
            if (ShellPage.MainFrame?.CanGoBack == true)
            {
                ShellPage.MainFrame.GoBack();
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("detail", $"delete failed: {ex.Message}");
        }
    }
}




