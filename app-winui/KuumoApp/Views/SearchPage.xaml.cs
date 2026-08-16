using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;

namespace KuumoApp.Views;

public sealed partial class SearchPage : Page
{
    private static readonly string[] Types = { MusicType.Track, MusicType.Playlist, MusicType.Artist };
    private string _selectedType = MusicType.Track;
    private SearchResultDto? _result;

    public SearchPage()
    {
        InitializeComponent();
        TypeTabs.ItemsSource = Types.Select(t => t == MusicType.Track ? "Tracks" : t == MusicType.Playlist ? "Playlists" : "Artists").ToArray();
        TypeTabs.SelectedIndex = 0;
        ItemMenu.AttachMoreButton(ResultList);
    }

    public void FocusSearch()
    {
        SearchBox.Focus(FocusState.Keyboard);
        SearchBox.SelectAll();
    }

    private void OnTypeClick(object sender, ItemClickEventArgs e)
    {
        _selectedType = Types[TypeTabs.SelectedIndex];
        if (SearchBox.Text.Trim().Length > 0)
        {
            _ = SearchAsync();
        }
    }

    private void OnSearchKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            _ = SearchAsync();
        }
    }

    private void OnSearchClick(object sender, RoutedEventArgs e) => _ = SearchAsync();

    private async Task SearchAsync()
    {
        var query = SearchBox.Text.Trim();
        if (query.Length == 0)
        {
            return;
        }
        if (TryResolveLink(query, out var source, out var type, out var id))
        {
            if (type == MusicType.Track)
            {
                await Playback.PlayEntryAsync($"{source}:{type}:{id}");
            }
            else
            {
                ShellPage.NavigateDetail(source, type, id);
            }
            return;
        }
        try
        {
            _result = await App.Services.Api.SearchMusicAsync(_selectedType, MusicSource.Youtube, query);
            await RenderResultsAsync();
            ShellPage.SetTitle($"{TitleFor(query)} search result");
        }
        catch (Exception ex)
        {
            AppLog.Write("search", $"search failed: {ex.Message}");
            _result = null;
            ResultList.ItemsSource = null;
            ShellPage.SetTitle("Search");
        }
    }

    private static string TitleFor(string query)
    {
        const int max = 40;
        return query.Length <= max ? query : query[..max] + "...";
    }

    private static bool TryResolveLink(string input, out string source, out string type, out string id)
    {
        source = "";
        type = "";
        id = "";

        var parts = input.Split(':');
        if (parts.Length == 3 && parts.All(p => p.Length > 0))
        {
            source = parts[1];
            type = parts[0];
            id = parts[2];
            if (MusicSource.Youtube == source || MusicSource.Local == source)
            {
                return IsValidEntryId(type, id);
            }
        }

        try
        {
            var url = new Uri(input.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? input : $"https://{input}");
            var host = url.Host;
            if (!host.Contains("youtube.com") && !host.Contains("youtu.be"))
            {
                return false;
            }
            if (host == "youtu.be")
            {
                var ytId = url.AbsolutePath.Trim('/').Split('/')[0];
                if (ytId.Length == 0)
                {
                    return false;
                }
                source = MusicSource.Youtube;
                type = ytId.Length > 20 ? MusicType.Playlist : MusicType.Track;
                id = ytId;
                return true;
            }
            if (url.AbsolutePath.Contains("/live/"))
            {
                var liveId = url.AbsolutePath.Split("/live/")[1]?.Split('/')[0] ?? "";
                if (liveId.Length == 0)
                {
                    return false;
                }
                source = MusicSource.Youtube;
                type = MusicType.Track;
                id = liveId;
                return true;
            }
            var v = GetQueryParam(url, "v");
            if (v is { Length: > 0 })
            {
                source = MusicSource.Youtube;
                type = MusicType.Track;
                id = v;
                return true;
            }
            var list = GetQueryParam(url, "list");
            if (list is { Length: > 0 })
            {
                source = MusicSource.Youtube;
                type = MusicType.Playlist;
                id = list;
                return true;
            }
            if (url.AbsolutePath.StartsWith("/channel/"))
            {
                var channelId = url.AbsolutePath.Split("/channel/")[1]?.Split('/')[0] ?? "";
                if (channelId.Length == 0)
                {
                    return false;
                }
                source = MusicSource.Youtube;
                type = MusicType.Artist;
                id = channelId;
                return true;
            }
            if (url.AbsolutePath.StartsWith("/@"))
            {
                var handle = url.AbsolutePath.Split("/@")[1]?.Split('/')[0] ?? "";
                if (handle.Length == 0)
                {
                    return false;
                }
                source = MusicSource.Youtube;
                type = MusicType.Artist;
                id = handle;
                return true;
            }
        }
        catch
        {
        }
        return false;
    }

    private static bool IsValidEntryId(string type, string id)
    {
        if (type == MusicType.Artist)
        {
            return id.StartsWith("UC") || id.StartsWith("UU") || id.StartsWith("@");
        }
        if (type == MusicType.Playlist)
        {
            return id.StartsWith("PL") || id.StartsWith("OLAK5uy_") || id.StartsWith("UU") || id.StartsWith("RD") || id.StartsWith("VL");
        }
        return true;
    }

    private static string? GetQueryParam(Uri url, string name)
    {
        var query = url.Query.TrimStart('?');
        foreach (var pair in query.Split('&'))
        {
            var kv = pair.Split('=');
            if (kv.Length == 2 && kv[0] == name)
            {
                return Uri.UnescapeDataString(kv[1]);
            }
        }
        return null;
    }

    private async Task RenderResultsAsync()
    {
        if (_result is null)
        {
            return;
        }
        object[] rows;
        switch (_selectedType)
        {
            case MusicType.Playlist:
                rows = _result.Playlists.Select(p => (object)new MediaCard("playlist", p.Source, MusicType.Playlist, p.Id, p.Name, $"{p.Tracks?.Length ?? 0} tracks", p.Thumbnail)).ToArray();
                ResultList.ItemTemplate = (DataTemplate)App.Current.Resources["CardTemplate"];
                break;
            case MusicType.Artist:
                rows = _result.Artists.Select(a => (object)new MediaCard("artist", a.Source, MusicType.Artist, a.Id, a.Name, "Artist", a.Thumbnail)).ToArray();
                ResultList.ItemTemplate = (DataTemplate)App.Current.Resources["CardTemplate"];
                break;
            default:
                rows = _result.Tracks.Select(TrackRow.FromTrack).Cast<object>().ToArray();
                ResultList.ItemTemplate = (DataTemplate)App.Current.Resources["TrackRowTemplate"];
                break;
        }
        ResultList.ItemsSource = rows;
    }

    private async void OnResultClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is MediaCard card)
        {
            if (card.Kind == "track")
            {
                await Playback.PlayEntryAsync($"{card.Source}:{card.Type}:{card.Id}");
            }
            else
            {
                ShellPage.NavigateDetail(card.Source, card.Type, card.Id);
            }
        }
        else if (e.ClickedItem is TrackRow row)
        {
            await Playback.PlayTrackAsync(row.Payload!, row.Source, row.Type, row.Id);
        }
    }

    private async void OnResultRightTapped(object sender, RightTappedRoutedEventArgs e)
    {
        if (e.OriginalSource is not FrameworkElement element)
        {
            return;
        }
        var item = FindItem(element);
        if (item is null)
        {
            return;
        }
        MenuFlyout flyout;
        if (item is MediaCard card)
        {
            flyout = await ItemMenu.BuildAsync(card);
        }
        else if (item is TrackRow row)
        {
            flyout = await ItemMenu.BuildAsync(row);
        }
        else
        {
            return;
        }
        ItemMenu.Show(flyout, element, e.GetPosition(element));
    }

    private static object? FindItem(FrameworkElement element)
    {
        var current = element;
        while (current is not null)
        {
            if (current.DataContext is MediaCard or TrackRow)
            {
                return current.DataContext;
            }
            current = current.Parent as FrameworkElement;
        }
        return null;
    }
}
