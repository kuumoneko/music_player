using System.Text.Json;
using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace KuumoApp.Views;

public sealed partial class HomePage : Page
{
    private const int MaxRowItems = 10;
    private int _loadVersion;

    public HomePage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        App.Services.Rpc.Connected += OnRpcConnected;
        App.Services.Events.RefetchRequested += OnRefetch;
        App.Services.Events.DataChanged += OnDataChanged;
        if (App.Services.Rpc.IsConnected)
        {
            _ = LoadAsync();
        }
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        App.Services.Rpc.Connected -= OnRpcConnected;
        App.Services.Events.RefetchRequested -= OnRefetch;
        App.Services.Events.DataChanged -= OnDataChanged;
    }

    private void OnRpcConnected() => DispatcherQueue.TryEnqueue(() => _ = LoadAsync());
    private void OnRefetch() => _ = LoadAsync();
    private void OnDataChanged(string key)
    {
        if (key is "userPlaylists" or "userSubscriptions" or "homeFeed")
        {
            _ = LoadAsync();
        }
    }

    private async Task LoadAsync()
    {
        var version = ++_loadVersion;
        LoadingRing.IsActive = true;
        Root.Children.Clear();
        try
        {
            var feedTask = App.Services.Api.GetHomeFeedAsync();
            var localTask = App.Services.Api.GetUserPlaylistsAsync();
            var ytPlaylistsTask = App.Services.Api.GetUserYoutubePlaylistsAsync();
            var subscriptionsTask = App.Services.Api.GetUserYoutubeSubscriptionsAsync();

            var localPlaylists = await localTask ?? [];
            if (version != _loadVersion)
            {
                return;
            }

            var playlists = Merge(localPlaylists.Select(MediaCard.FromPlaylist));
            var playlistsRowStart = -1;
            if (playlists.Count > 0)
            {
                playlistsRowStart = InsertRow(Root.Children.Count, "Your Playlists", playlists, withCreate: true, sourceKey: "userPlaylists", reload: LoadMergedPlaylistsAsync);
            }

            var ytPlaylists = await ytPlaylistsTask ?? [];
            if (version != _loadVersion)
            {
                return;
            }
            if (ytPlaylists is { Length: > 0 })
            {
                playlists = Merge(ytPlaylists.Select(MediaCard.FromPlaylist), localPlaylists.Select(MediaCard.FromPlaylist));
                if (playlistsRowStart >= 0)
                {
                    RemoveFrom(playlistsRowStart);
                    playlistsRowStart = InsertRow(playlistsRowStart, "Your Playlists", playlists, withCreate: true, sourceKey: "userPlaylists", reload: LoadMergedPlaylistsAsync);
                }
                else
                {
                    playlistsRowStart = InsertRow(Root.Children.Count, "Your Playlists", playlists, withCreate: true, sourceKey: "userPlaylists", reload: LoadMergedPlaylistsAsync);
                }
            }

            var subscriptions = await subscriptionsTask ?? [];
            if (version != _loadVersion)
            {
                return;
            }

            var artists = Merge(subscriptions.Select(MediaCard.FromArtist));
            var artistsRowStart = -1;
            if (artists.Count > 0)
            {
                artistsRowStart = InsertRow(Root.Children.Count, "Artists", artists, withCreate: false, sourceKey: "userSubscriptions", reload: LoadMergedArtistsAsync);
            }

            var sections = (await feedTask)?.Sections ?? [];
            if (version != _loadVersion)
            {
                return;
            }

            var pinnedArtists = CardsFromSections(sections, "pinned_artists");
            var pinnedPlaylists = CardsFromSections(sections, "pinned_playlists");
            var pinnedTracks = CardsFromSections(sections, "pinned_tracks");
            var pinnedNewTracks = CardsFromSections(sections, "pinned_new_tracks");

            var rebuildPlaylists = playlistsRowStart >= 0 && pinnedPlaylists.Length > 0;
            var rebuildArtists = artistsRowStart >= 0 && pinnedArtists.Length > 0;
            if (rebuildPlaylists)
            {
                RemoveFrom(playlistsRowStart);
                InsertRow(playlistsRowStart, "Your Playlists", Merge(pinnedPlaylists, ytPlaylists.Select(MediaCard.FromPlaylist), localPlaylists.Select(MediaCard.FromPlaylist)), withCreate: true, sourceKey: "userPlaylists", reload: LoadMergedPlaylistsAsync);
                if (rebuildArtists)
                {
                    InsertRow(Root.Children.Count, "Artists", Merge(pinnedArtists, subscriptions.Select(MediaCard.FromArtist)), withCreate: false, sourceKey: "userSubscriptions", reload: LoadMergedArtistsAsync);
                }
                else
                {
                    InsertRow(Root.Children.Count, "Artists", artists, withCreate: false, sourceKey: "userSubscriptions", reload: LoadMergedArtistsAsync);
                }
            }
            else if (rebuildArtists)
            {
                RemoveFrom(artistsRowStart);
                InsertRow(artistsRowStart, "Artists", Merge(pinnedArtists, subscriptions.Select(MediaCard.FromArtist)), withCreate: false, sourceKey: "userSubscriptions", reload: LoadMergedArtistsAsync);
            }
            if (playlistsRowStart < 0 && pinnedPlaylists.Length > 0)
            {
                InsertRow(Root.Children.Count, "Your Playlists", Merge(pinnedPlaylists), withCreate: true, sourceKey: "userPlaylists", reload: LoadMergedPlaylistsAsync);
            }
            if (artistsRowStart < 0 && pinnedArtists.Length > 0)
            {
                InsertRow(Root.Children.Count, "Artists", Merge(pinnedArtists), withCreate: false, sourceKey: "userSubscriptions", reload: LoadMergedArtistsAsync);
            }

            if (sections.Length == 0)
            {
                var home = await App.Services.Api.GetHomeDataAsync();
                if (version != _loadVersion)
                {
                    return;
                }
                if (home is not null)
                {
                    RenderSection("Playlists", home.Playlists.Select(MediaCard.FromPlaylist));
                    RenderSection("Tracks", home.Tracks.Select(MediaCard.FromTrack));
                    RenderGridSection("New tracks", home.NewTracks.Select(MediaCard.FromTrack));
                }
            }
            else
            {
                foreach (var section in sections)
                {
                    if (section.Type.StartsWith("pinned_"))
                    {
                        continue;
                    }
                    var items = CardsFromSection(section);
                    if (items.Length > 0)
                    {
                        RenderSection(section.Title, items);
                    }
                }
            }

            if (pinnedTracks.Length > 0)
            {
                RenderRow("Your Tracks", pinnedTracks, withCreate: false);
            }
            if (pinnedNewTracks.Length > 0)
            {
                RenderGridSection("New From Your Artists", pinnedNewTracks);
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("home", $"load failed: {ex.GetType().Name}: {ex}");
            if (version == _loadVersion)
            {
                Root.Children.Add(new TextBlock { Text = $"Failed to load home: {ex.GetType().Name}: {ex.Message}" });
            }
        }
        if (version == _loadVersion)
        {
            LoadingRing.IsActive = false;
        }
    }

    private async Task<(HomeFeedSectionDto[] Sections, List<MediaCard> Playlists, List<MediaCard> Artists)> LoadCardsAsync()
    {
        var feedTask = App.Services.Api.GetHomeFeedAsync();
        var localTask = App.Services.Api.GetUserPlaylistsAsync();
        var ytPlaylistsTask = App.Services.Api.GetUserYoutubePlaylistsAsync();
        var subscriptionsTask = App.Services.Api.GetUserYoutubeSubscriptionsAsync();
        await Task.WhenAll(feedTask, localTask, ytPlaylistsTask, subscriptionsTask);

        var sections = feedTask.Result?.Sections ?? [];
        var localPlaylists = localTask.Result ?? [];
        var ytPlaylists = ytPlaylistsTask.Result ?? [];
        var subscriptions = subscriptionsTask.Result ?? [];

        var pinnedArtists = CardsFromSections(sections, "pinned_artists");
        var pinnedPlaylists = CardsFromSections(sections, "pinned_playlists");

        var playlists = Merge(
            pinnedPlaylists,
            ytPlaylists.Select(MediaCard.FromPlaylist),
            localPlaylists.Select(MediaCard.FromPlaylist));
        var artists = Merge(pinnedArtists, subscriptions.Select(MediaCard.FromArtist));

        return (sections, playlists, artists);
    }

    private async Task<MediaCard[]> LoadMergedPlaylistsAsync()
    {
        var (_, playlists, _) = await LoadCardsAsync();
        return playlists.ToArray();
    }

    private async Task<MediaCard[]> LoadMergedArtistsAsync()
    {
        var (_, _, artists) = await LoadCardsAsync();
        return artists.ToArray();
    }

    private static MediaCard[] CardsFromSections(HomeFeedSectionDto[] sections, string type)
        => sections.FirstOrDefault(s => s.Type == type) is { } section ? CardsFromSection(section) : [];

    private static MediaCard[] CardsFromSection(HomeFeedSectionDto section)
    {
        var targetType = section.ItemType switch
        {
            "playlist" => typeof(PlaylistDto),
            "artist" => typeof(ArtistDto),
            _ => typeof(TrackDto),
        };
        return section.Items
            .Select(el => JsonSerializer.Deserialize(el, targetType, RpcClient.Json))
            .Where(o => o is not null)
            .Select(o => o switch
            {
                TrackDto t => MediaCard.FromTrack(t),
                PlaylistDto p => MediaCard.FromPlaylist(p),
                ArtistDto a => MediaCard.FromArtist(a),
                _ => null,
            })
            .Where(c => c is not null)
            .Cast<MediaCard>()
            .ToArray();
    }

    private static List<MediaCard> Merge(params IEnumerable<MediaCard>[] groups)
    {
        var result = new List<MediaCard>();
        var seen = new HashSet<string>();
        foreach (var group in groups)
        {
            foreach (var card in group)
            {
                if (seen.Add($"{card.Source}:{card.Type}:{card.Id}"))
                {
                    result.Add(card);
                }
            }
        }
        return result;
    }

    private void RenderRow(string title, IReadOnlyList<MediaCard> allCards, bool withCreate, string sourceKey = "", Func<Task<MediaCard[]>>? reload = null)
    {
        InsertRow(Root.Children.Count, title, allCards, withCreate, sourceKey, reload);
    }

    private int InsertRow(int index, string title, IReadOnlyList<MediaCard> allCards, bool withCreate, string sourceKey = "", Func<Task<MediaCard[]>>? reload = null)
    {
        var start = index;
        var header = new Grid { ColumnSpacing = 8 };
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        header.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 20,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
        });

        StackPanel? createRow = null;
        if (withCreate)
        {
            createRow = BuildCreateRow();
        }

        var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        if (withCreate)
        {
            var plusButton = new Button
            {
                Content = new FontIcon { Glyph = "\uE710" },
                Padding = new Thickness(10, 6, 10, 6),
            };
            plusButton.Click += (_, _) =>
            {
                if (createRow is null) return;
                createRow.Visibility = createRow.Visibility == Visibility.Visible
                    ? Visibility.Collapsed
                    : Visibility.Visible;
            };
            actions.Children.Add(plusButton);
        }
        if (allCards.Count > MaxRowItems)
        {
            var cards = allCards.ToArray();
            var seeAll = new Button
            {
                Content = "See all",
                Padding = new Thickness(10, 6, 10, 6),
            };
            seeAll.Click += (_, _) =>
                ShellPage.MainFrame?.Navigate(typeof(CollectionPage), new CollectionNav(title, cards, sourceKey, reload));
            actions.Children.Add(seeAll);
        }
        Grid.SetColumn(actions, 1);
        header.Children.Add(actions);
        Root.Children.Insert(index++, header);

        if (createRow is not null)
        {
            Root.Children.Insert(index++, createRow);
        }

        Root.Children.Insert(index, CardStrip.Build(allCards.Take(MaxRowItems), MediaGrid.DefaultOpen));
        return start;
    }

    private void RemoveFrom(int start)
    {
        while (Root.Children.Count > start)
        {
            Root.Children.RemoveAt(Root.Children.Count - 1);
        }
    }

    private StackPanel BuildCreateRow()
    {
        var createRow = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 8,
            Visibility = Visibility.Collapsed,
        };
        var nameBox = new TextBox { PlaceholderText = "Playlist name", Width = 240 };
        var okButton = new Button { Content = new FontIcon { Glyph = "\uE73E" } };
        createRow.Children.Add(nameBox);
        createRow.Children.Add(okButton);

        async Task CreateAsync()
        {
            var name = nameBox.Text.Trim();
            if (name.Length == 0)
            {
                return;
            }
            try
            {
                await App.Services.Api.CreatePlaylistAsync(name);
                nameBox.Text = "";
                createRow.Visibility = Visibility.Collapsed;
                _ = LoadAsync();
            }
            catch (Exception ex)
            {
                AppLog.Write("home", $"create playlist failed: {ex.Message}");
            }
        }

        okButton.Click += (_, _) => _ = CreateAsync();
        nameBox.KeyDown += (_, args) =>
        {
            if (args.Key == Windows.System.VirtualKey.Enter)
            {
                _ = CreateAsync();
            }
        };
        return createRow;
    }

    private void RenderSection(string title, IEnumerable<MediaCard> items)
    {
        Root.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 20,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
        });
        Root.Children.Add(CardStrip.Build(items, MediaGrid.DefaultOpen));
    }

    private void RenderGridSection(string title, IEnumerable<MediaCard> items)
    {
        Root.Children.Add(new TextBlock
        {
            Text = title,
            FontSize = 20,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
        });
        Root.Children.Add(MediaGrid.BuildGrid(items.ToArray(), MediaGrid.DefaultOpen));
    }
}
