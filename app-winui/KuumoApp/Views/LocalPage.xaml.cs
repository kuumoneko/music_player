using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;

namespace KuumoApp.Views;

public sealed partial class LocalPage : Page
{
    public LocalPage()
    {
        InitializeComponent();
        ItemMenu.AttachMoreButton(LocalList);
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        App.Services.Rpc.Connected += OnRpcConnected;
        App.Services.Events.LocalFilesChanged += OnLocalFilesChanged;
        NowPlaying.Watch(LocalList);
        if (App.Services.Rpc.IsConnected)
        {
            _ = LoadAsync();
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        App.Services.Rpc.Connected -= OnRpcConnected;
        App.Services.Events.LocalFilesChanged -= OnLocalFilesChanged;
        NowPlaying.Unwatch(LocalList);
    }

    private void OnLocalFilesChanged() => _ = LoadAsync();
    private void OnRpcConnected() => DispatcherQueue.TryEnqueue(() => _ = LoadAsync());

    private void OnRefreshClick(object sender, RoutedEventArgs e) => _ = LoadAsync();

    private async void OnReloadClick(object sender, RoutedEventArgs e)
    {
        LoadingRing.IsActive = true;
        try
        {
            await App.Services.Api.RehashLocalFilesAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("local", $"rehash failed: {ex.Message}");
            ToastService.ShowError($"Rehash failed: {ex.Message}");
        }
        finally
        {
            LoadingRing.IsActive = false;
        }
    }

    private async Task LoadAsync()
    {
        LoadingRing.IsActive = true;
        EmptyText.Visibility = Visibility.Collapsed;
        try
        {
            var tracks = await App.Services.Api.GetLocalfileAsync();
            _tracks = tracks ?? [];
            ApplyFilter();
        }
        catch (Exception ex)
        {
            AppLog.Write("local", $"load failed: {ex.Message}");
            ToastService.ShowError($"Failed to load local files: {ex.Message}");
        }
        finally
        {
            LoadingRing.IsActive = false;
        }
    }

    private TrackDto[] _tracks = [];

    private void OnFilterChanged(object sender, TextChangedEventArgs e) => ApplyFilter();

    private void ApplyFilter()
    {
        var filter = FilterBox.Text.Trim();
        var filtered = string.IsNullOrEmpty(filter)
            ? _tracks
            : _tracks.Where(t => MatchesFilter(t, filter)).ToArray();

        LocalTitle.Text = string.IsNullOrEmpty(filter)
            ? $"Local files ({_tracks.Length})"
            : $"Local files ({filtered.Length} of {_tracks.Length})";
        LocalList.ItemsSource = filtered.Select(TrackRow.FromTrack).ToArray();

        var hasAny = _tracks.Length > 0;
        var empty = !hasAny
            ? "No local files found. Set a music folder in Settings."
            : $"No local files match \"{filter}\".";
        EmptyText.Text = empty;
        EmptyText.Visibility = filtered.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
        LocalList.Visibility = filtered.Length > 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private static bool MatchesFilter(TrackDto track, string filter)
    {
        if (track.Name.Contains(filter, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        return track.Artist?.Any(a => a.Name.Contains(filter, StringComparison.OrdinalIgnoreCase)) == true;
    }

    private async void OnLocalClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is TrackRow row)
        {
            await Playback.PlayTrackAsync(row.Payload!, row.Source, MusicType.Local, row.Id);
        }
    }

    private async void OnLocalRightTapped(object sender, RightTappedRoutedEventArgs e)
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
                var flyout = await ItemMenu.BuildAsync(row);
                ItemMenu.Show(flyout, current, e.GetPosition(current));
                return;
            }
            current = current.Parent as FrameworkElement;
        }
    }
}



