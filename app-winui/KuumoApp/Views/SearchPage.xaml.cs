using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;

namespace KuumoApp.Views;

public sealed partial class SearchPage : Page
{
    private static readonly string[] Types = { MusicType.Track, MusicType.Playlist, MusicType.Artist };
    private static readonly string[] TypeLabels = { "Tracks", "Playlists", "Artists" };
    private static readonly string[] SourceLabels = { "YouTube", "Local" };
    private string _selectedType = MusicType.Track;
    private string _selectedSource = MusicSource.Youtube;
    private int _typeIndex;
    private SearchResultDto? _result;
    private string? _continuation;
    private bool _loadingMore;
    private readonly List<string> _recent = [];
    private int _searchVersion;
    private readonly DispatcherQueueTimer _debounceTimer;

    public SearchPage()
    {
        InitializeComponent();
        _debounceTimer = DispatcherQueue.CreateTimer();
        _debounceTimer.Interval = TimeSpan.FromMilliseconds(300);
        _debounceTimer.IsRepeating = false;
        _debounceTimer.Tick += (_, _) => _ = SearchAsync();
        SourceTabs.ItemsSource = SourceLabels;
        SourceTabs.SelectedIndex = 0;
        TypeTabs.ItemsSource = TypeLabels;
        TypeTabs.SelectedIndex = 0;
        ItemMenu.AttachMoreButton(ResultList);
        _ = LoadRecentAsync();
    }

    private async Task LoadRecentAsync()
    {
        try
        {
            if (!App.Services.Rpc.IsConnected)
            {
                return;
            }
            var saved = await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.RecentSearches);
            if (saved is not null && saved.Length > 0)
            {
                _recent.Clear();
                _recent.AddRange(saved.Take(RecentLimit));
                RenderRecent();
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("search", $"recent searches load failed: {ex.Message}");
        }
    }

    private const int RecentLimit = 8;

    private void RememberSearch(string query)
    {
        _recent.RemoveAll(c => string.Equals(c, query, StringComparison.OrdinalIgnoreCase));
        _recent.Insert(0, query);
        if (_recent.Count > RecentLimit)
        {
            _recent.RemoveRange(RecentLimit, _recent.Count - RecentLimit);
        }
        RenderRecent();
        _ = App.Services.Api.SetUserDataAsync(UserDataKeys.RecentSearches, _recent.ToArray());
        UpdateRecentVisibility();
    }

    private void RenderRecent()
    {
        RecentPanel.Children.Clear();
        if (_recent.Count == 0)
        {
            RecentPanel.Visibility = Visibility.Collapsed;
            return;
        }
        RecentPanel.Children.Add(new TextBlock
        {
            Text = "Recent",
            Opacity = 0.6,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(0, 0, 4, 0),
        });
        foreach (var query in _recent)
        {
            var button = new Button
            {
                Content = query,
                Padding = new Thickness(8, 2, 8, 2),
                Margin = new Thickness(0, 0, 6, 0),
            };
            AutomationProperties.SetName(button, $"Search for {query}");
            button.Click += OnRecentClick;
            RecentPanel.Children.Add(button);
        }
        var clear = new Button { Content = "Clear" };
        clear.Click += OnRecentClear;
        RecentPanel.Children.Add(clear);
    }

    private void UpdateRecentVisibility()
    {
        RecentPanel.Visibility = _recent.Count > 0 && SearchBox.Text.Trim().Length == 0
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    private void OnRecentClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button button)
        {
            return;
        }
        SearchBox.Text = button.Content?.ToString() ?? "";
        _ = SearchAsync();
    }

    private void OnRecentClear(object sender, RoutedEventArgs e)
    {
        _recent.Clear();
        RenderRecent();
        UpdateRecentVisibility();
        _ = App.Services.Api.SetUserDataAsync(UserDataKeys.RecentSearches, Array.Empty<string>());
    }

    public void FocusSearch()
    {
        SearchBox.Focus(FocusState.Keyboard);
        SearchBox.SelectAll();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        NowPlaying.Watch(ResultList);
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        NowPlaying.Unwatch(ResultList);
    }

    // Local search only supports tracks, so the source toggle narrows the type tabs.
    private void OnSourceClick(object sender, ItemClickEventArgs e)
    {
        _selectedSource = SourceTabs.SelectedIndex == 1 ? MusicSource.Local : MusicSource.Youtube;
        if (_selectedSource == MusicSource.Local)
        {
            TypeTabs.ItemsSource = new[] { TypeLabels[0] };
            TypeTabs.SelectedIndex = 0;
            _selectedType = MusicType.Track;
        }
        else
        {
            TypeTabs.ItemsSource = TypeLabels;
            TypeTabs.SelectedIndex = Math.Min(_typeIndex, TypeLabels.Length - 1);
            _selectedType = Types[TypeTabs.SelectedIndex];
        }
        if (SearchBox.Text.Trim().Length > 0)
        {
            _ = SearchAsync();
        }
    }

    private void OnTypeClick(object sender, ItemClickEventArgs e)
    {
        _typeIndex = TypeTabs.SelectedIndex;
        _selectedType = Types[_typeIndex];
        if (SearchBox.Text.Trim().Length > 0)
        {
            _ = SearchAsync();
        }
    }

    private void OnSearchTextChanged(object sender, TextChangedEventArgs e)
    {
        UpdateRecentVisibility();
        _debounceTimer.Stop();
        if (SearchBox.Text.Trim().Length > 0)
        {
            _debounceTimer.Start();
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
                await Playback.PlayEntryAsync(EntryFormat.Build(source, MusicType.Track, id));
            }
            else
            {
                ShellPage.NavigateDetail(source, type, id);
            }
            return;
        }
        var version = ++_searchVersion;
        _continuation = null;
        LoadMoreButton.Visibility = Visibility.Collapsed;
        try
        {
            SearchingRing.IsActive = true;
            ErrorPanel.Visibility = Visibility.Collapsed;
            _result = await App.Services.Api.SearchMusicAsync(_selectedType, _selectedSource, query);
            if (version != _searchVersion)
            {
                return;
            }
            await RenderResultsAsync();
            RememberSearch(query);
            ShellPage.SetTitle($"{TitleFor(query)} search result");
        }
        catch (Exception ex)
        {
            if (version != _searchVersion)
            {
                return;
            }
            AppLog.Write("search", $"search failed: {ex.Message}");
            ToastService.ShowError($"Search failed: {ex.Message}");
            _result = null;
            _continuation = null;
            ResultList.ItemsSource = null;
            NoResultsText.Visibility = Visibility.Collapsed;
            ErrorText.Text = $"Search failed: {ex.Message}";
            ErrorPanel.Visibility = Visibility.Visible;
            ShellPage.SetTitle("Search");
        }
        finally
        {
            if (version == _searchVersion)
            {
                SearchingRing.IsActive = false;
            }
        }
    }

    private void OnRetryClick(object sender, RoutedEventArgs e) => _ = SearchAsync();

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
        ErrorPanel.Visibility = Visibility.Collapsed;
        ResultList.ItemsSource = rows;
        NoResultsText.Visibility = rows.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
        _continuation = _result.Continuation;
        LoadMoreButton.Visibility = string.IsNullOrEmpty(_continuation) ? Visibility.Collapsed : Visibility.Visible;
    }

    private void OnLoadMoreClick(object sender, RoutedEventArgs e) => _ = LoadMoreAsync();

    private async Task LoadMoreAsync()
    {
        var token = _continuation;
        if (_loadingMore || string.IsNullOrEmpty(token))
        {
            return;
        }
        var query = SearchBox.Text.Trim();
        var version = _searchVersion;
        _loadingMore = true;
        LoadMoreButton.IsEnabled = false;
        try
        {
            var more = await App.Services.Api.SearchMoreAsync(_selectedType, _selectedSource, query, token!);
            if (version != _searchVersion || more is null)
            {
                return;
            }
            AppendResults(more);
        }
        catch (Exception ex)
        {
            AppLog.Write("search", $"load more failed: {ex.Message}");
            ToastService.ShowError($"Could not load more results: {ex.Message}");
        }
        finally
        {
            _loadingMore = false;
            if (version == _searchVersion)
            {
                LoadMoreButton.IsEnabled = true;
            }
        }
    }

    private void AppendResults(SearchResultDto more)
    {
        object[] added = _selectedType switch
        {
            MusicType.Playlist => more.Playlists.Select(p => (object)new MediaCard("playlist", p.Source, MusicType.Playlist, p.Id, p.Name, $"{p.Tracks?.Length ?? 0} tracks", p.Thumbnail)).ToArray(),
            MusicType.Artist => more.Artists.Select(a => (object)new MediaCard("artist", a.Source, MusicType.Artist, a.Id, a.Name, "Artist", a.Thumbnail)).ToArray(),
            _ => more.Tracks.Select(TrackRow.FromTrack).Cast<object>().ToArray(),
        };
        if (added.Length == 0 && string.IsNullOrEmpty(more.Continuation))
        {
            // Nothing left to page through - hide the button rather than offering a dead end.
            LoadMoreButton.Visibility = Visibility.Collapsed;
            return;
        }
        var current = ResultList.ItemsSource as object[] ?? [];
        ResultList.ItemsSource = current.Concat(added).ToArray();
        _continuation = more.Continuation;
        NoResultsText.Visibility = Visibility.Collapsed;
        LoadMoreButton.Visibility = string.IsNullOrEmpty(_continuation) ? Visibility.Collapsed : Visibility.Visible;
    }

    private async void OnResultClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is MediaCard card)
        {
            if (card.Kind == "track")
            {
                await Playback.PlayEntryAsync(EntryFormat.Build(card.Source, card.Type, card.Id));
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
