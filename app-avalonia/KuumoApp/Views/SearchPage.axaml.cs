using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class SearchPage : UserControl
{
    private static readonly string[] Types = { MusicType.Track, MusicType.Playlist, MusicType.Artist };
    private static readonly string[] TypeLabels = { "Tracks", "Playlists", "Artists" };
    private string _selectedType = MusicType.Track;
    private SearchResultDto? _result;
    private int _searchVersion;
    private readonly List<Button> _typeButtons = [];

    public SearchPage()
    {
        InitializeComponent();
        foreach (var (type, label) in Types.Zip(TypeLabels))
        {
            var btn = new Button { Content = label, Tag = type };
            btn.Click += OnTypeClick;
            _typeButtons.Add(btn);
            TypeTabs.Children.Add(btn);
        }
        UpdateTypeButtonStyles();
    }

    public void FocusSearch()
    {
        SearchBox?.Focus();
        SearchBox?.SelectAll();
    }

    private void OnTypeClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string type })
        {
            _selectedType = type;
            UpdateTypeButtonStyles();
            if (SearchBox.Text?.Trim().Length > 0)
            {
                _ = SearchAsync();
            }
        }
    }

    private void UpdateTypeButtonStyles()
    {
        foreach (var btn in _typeButtons)
        {
            if ((string?)btn.Tag == _selectedType)
            {
                btn.Classes.Add("accent");
            }
            else
            {
                btn.Classes.Remove("accent");
            }
        }
    }

    private void OnSearchKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            _ = SearchAsync();
        }
    }

    private void OnSearchClick(object? sender, RoutedEventArgs e) => _ = SearchAsync();

    private async System.Threading.Tasks.Task SearchAsync()
    {
        var query = SearchBox.Text?.Trim() ?? "";
        if (query.Length == 0) return;

        if (TryResolveLink(query, out var source, out var type, out var id))
        {
            if (type == MusicType.Track)
                await Playback.PlayEntryAsync($"{source}:{type}:{id}");
            else
                ShellPage.NavigateDetail(source, type, id);
            return;
        }

        var version = ++_searchVersion;
        try
        {
            SearchingRing.IsVisible = true;
            _result = await App.Services.Api.SearchMusicAsync(_selectedType, MusicSource.Youtube, query);
            if (version != _searchVersion) return;
            RenderResults();
            ShellPage.SetTitle($"{TitleFor(query)} search result");
        }
        catch (Exception ex)
        {
            if (version != _searchVersion) return;
            AppLog.Write("search", $"search failed: {ex.Message}");
            _result = null;
            ResultPanel.Children.Clear();
            StatusText.Text = "No results";
            StatusText.IsVisible = true;
            ShellPage.SetTitle("Search");
        }
        finally
        {
            if (version == _searchVersion)
            {
                SearchingRing.IsVisible = false;
            }
        }
    }

    private static string TitleFor(string query)
    {
        const int max = 40;
        return query.Length <= max ? query : query[..max] + "...";
    }

    private static bool TryResolveLink(string input, out string source, out string type, out string id)
    {
        source = ""; type = ""; id = "";
        var parts = input.Split(':');
        if (parts.Length == 3 && parts.All(p => p.Length > 0))
        {
            source = parts[1]; type = parts[0]; id = parts[2];
            if (MusicSource.Youtube == source || MusicSource.Local == source)
                return IsValidEntryId(type, id);
        }
        try
        {
            var url = new Uri(input.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? input : $"https://{input}");
            var host = url.Host;
            if (!host.Contains("youtube.com") && !host.Contains("youtu.be")) return false;
            if (host == "youtu.be")
            {
                var ytId = url.AbsolutePath.Trim('/').Split('/')[0];
                if (ytId.Length == 0) return false;
                source = MusicSource.Youtube;
                type = ytId.Length > 20 ? MusicType.Playlist : MusicType.Track;
                id = ytId;
                return true;
            }
            if (url.AbsolutePath.Contains("/live/"))
            {
                var liveId = url.AbsolutePath.Split("/live/")[1]?.Split('/')[0] ?? "";
                if (liveId.Length == 0) return false;
                source = MusicSource.Youtube; type = MusicType.Track; id = liveId;
                return true;
            }
            var v = GetQueryParam(url, "v");
            if (v is { Length: > 0 }) { source = MusicSource.Youtube; type = MusicType.Track; id = v; return true; }
            var list = GetQueryParam(url, "list");
            if (list is { Length: > 0 }) { source = MusicSource.Youtube; type = MusicType.Playlist; id = list; return true; }
            if (url.AbsolutePath.StartsWith("/channel/"))
            {
                var channelId = url.AbsolutePath.Split("/channel/")[1]?.Split('/')[0] ?? "";
                if (channelId.Length == 0) return false;
                source = MusicSource.Youtube; type = MusicType.Artist; id = channelId; return true;
            }
            if (url.AbsolutePath.StartsWith("/@"))
            {
                var handle = url.AbsolutePath.Split("/@")[1]?.Split('/')[0] ?? "";
                if (handle.Length == 0) return false;
                source = MusicSource.Youtube; type = MusicType.Artist; id = handle; return true;
            }
        }
        catch { }
        return false;
    }

    private static bool IsValidEntryId(string type, string id)
    {
        if (type == MusicType.Artist) return id.StartsWith("UC") || id.StartsWith("UU") || id.StartsWith("@");
        if (type == MusicType.Playlist) return id.StartsWith("PL") || id.StartsWith("OLAK5uy_") || id.StartsWith("UU") || id.StartsWith("RD") || id.StartsWith("VL");
        return true;
    }

    private static string? GetQueryParam(Uri url, string name)
    {
        var query = url.Query.TrimStart('?');
        foreach (var pair in query.Split('&'))
        {
            var kv = pair.Split('=');
            if (kv.Length == 2 && kv[0] == name) return Uri.UnescapeDataString(kv[1]);
        }
        return null;
    }

    private void RenderResults()
    {
        ResultPanel.Children.Clear();
        StatusText.IsVisible = false;
        if (_result is null) return;

        switch (_selectedType)
        {
            case MusicType.Playlist:
                foreach (var p in _result.Playlists ?? [])
                {
                    var card = new MediaCard("playlist", p.Source, MusicType.Playlist, p.Id, p.Name, $"{p.Tracks?.Length ?? 0} tracks", p.Thumbnail);
                    ResultPanel.Children.Add(BuildCardItem(card));
                }
                break;
            case MusicType.Artist:
                foreach (var a in _result.Artists ?? [])
                {
                    var card = new MediaCard("artist", a.Source, MusicType.Artist, a.Id, a.Name, "Artist", a.Thumbnail);
                    ResultPanel.Children.Add(BuildCardItem(card));
                }
                break;
            default:
                foreach (var t in _result.Tracks ?? [])
                {
                    var row = TrackRow.FromTrack(t);
                    ResultPanel.Children.Add(BuildTrackItem(row));
                }
                break;
        }

        if (ResultPanel.Children.Count == 0)
        {
            StatusText.Text = "No results";
            StatusText.IsVisible = true;
        }
    }

    private Control BuildCardItem(MediaCard card)
    {
        var thumb = new Image { Width = 48, Height = 48, Stretch = Stretch.UniformToFill };
        _ = ImageHelper.LoadAsync(thumb, card.Thumbnail);

        var titleBlock = new TextBlock { Text = card.Title, FontWeight = FontWeight.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis };
        var subtitleBlock = new TextBlock { Text = card.Subtitle, FontSize = 12, Opacity = 0.7, TextTrimming = TextTrimming.CharacterEllipsis };
        var infoPanel = new StackPanel { Spacing = 2, Margin = new Thickness(8, 0), VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center, Children = { titleBlock, subtitleBlock } };

        var grid = new Grid
        {
            ColumnDefinitions = new ColumnDefinitions("48,*"),
            Margin = new Thickness(0, 4),
            Children =
            {
                new Border { Width = 48, Height = 48, CornerRadius = new CornerRadius(4), ClipToBounds = true, Child = thumb },
                infoPanel,
            }
        };
        Grid.SetColumn(infoPanel, 1);

        var container = new Border
        {
            Background = Brushes.Transparent,
            Child = grid,
            CornerRadius = new CornerRadius(4),
            Padding = new Thickness(4),
        };

        var target = card;
        container.PointerPressed += async (_, e) =>
        {
            if (e.GetCurrentPoint(container).Properties.IsLeftButtonPressed)
            {
                if (target.Kind == "track")
                    await Playback.PlayEntryAsync($"{target.Source}:{target.Type}:{target.Id}");
                else
                    ShellPage.NavigateDetail(target.Source, target.Type, target.Id);
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
                await Playback.PlayTrackAsync(target.Payload!, target.Source, target.Type, target.Id);
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