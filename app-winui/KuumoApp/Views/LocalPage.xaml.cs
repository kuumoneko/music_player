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
    }

    private void OnLocalFilesChanged() => _ = LoadAsync();
    private void OnRpcConnected() => DispatcherQueue.TryEnqueue(() => _ = LoadAsync());

    private void OnRefreshClick(object sender, RoutedEventArgs e) => _ = LoadAsync();

    private async void OnReloadClick(object sender, RoutedEventArgs e)
    {
        try
        {
            await App.Services.Api.RehashLocalFilesAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("local", $"rehash failed: {ex.Message}");
        }
    }

    private async Task LoadAsync()
    {
        try
        {
            var tracks = await App.Services.Api.GetLocalfileAsync();
            LocalList.ItemsSource = tracks?.Select(TrackRow.FromTrack).ToArray();
            LocalTitle.Text = $"Local files ({tracks?.Length ?? 0})";
        }
        catch (Exception ex)
        {
            AppLog.Write("local", $"load failed: {ex.Message}");
        }
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



