using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class LocalPage : UserControl
{
    private TrackRow[] _tracks = [];

    public LocalPage()
    {
        InitializeComponent();
        AttachedToVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected += OnRpcConnected;
            App.Services.Events.LocalFilesChanged += OnLocalFilesChanged;
            if (App.Services.Rpc.IsConnected)
            {
                _ = LoadAsync();
            }
        };
        DetachedFromVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected -= OnRpcConnected;
            App.Services.Events.LocalFilesChanged -= OnLocalFilesChanged;
        };
    }

    private void OnLocalFilesChanged() => _ = LoadAsync();
    private void OnRpcConnected() => Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = LoadAsync());

    private void OnRefreshClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e) => _ = LoadAsync();

    private async void OnReloadClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
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
            _tracks = tracks?.Select(TrackRow.FromTrack).ToArray() ?? [];
            RenderTracks();
            LocalTitle.Text = $"Local files ({_tracks.Length})";
        }
        catch (Exception ex)
        {
            AppLog.Write("local", $"load failed: {ex.Message}");
        }
    }

    private void RenderTracks()
    {
        TrackPanel.Children.Clear();
        foreach (var row in _tracks)
        {
            var item = BuildTrackItem(row);
            TrackPanel.Children.Add(item);
        }
    }

    private Control BuildTrackItem(TrackRow row)
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
            FontSize = 12,
            Opacity = 0.7,
            TextTrimming = TextTrimming.CharacterEllipsis,
        };
        var durationBlock = new TextBlock
        {
            Text = row.DurationText,
            FontSize = 12,
            Opacity = 0.7,
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
                await Playback.PlayTrackAsync(target.Payload!, target.Source, MusicType.Local, target.Id);
            }
            else if (e.GetCurrentPoint(container).Properties.IsRightButtonPressed)
            {
                var menu = ItemMenu.Build(target);
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
}