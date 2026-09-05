using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.Foundation;

namespace KuumoApp.Views;

public static class ItemMenu
{
    private sealed record MoreOptions(Action<TrackRow>? ExtraAction, string ExtraLabel, DetailNav? Context);
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<ListView, MoreOptions> MoreButtonOptions = new();

    public static void AttachMoreButton(ListView list, Action<TrackRow>? extraAction = null, string extraLabel = "Remove from queue", DetailNav? context = null)
    {
        MoreButtonOptions.Remove(list);
        MoreButtonOptions.Add(list, new MoreOptions(extraAction, extraLabel, context));
        list.ContainerContentChanging += (_, args) =>
        {
            if (args.ItemContainer.ContentTemplateRoot is not Grid root)
            {
                return;
            }
            var button = FindMoreButton(root);
            if (button is null)
            {
                return;
            }
            if (args.InRecycleQueue)
            {
                button.Click -= OnMoreButtonClick;
                return;
            }
            button.Click -= OnMoreButtonClick;
            button.Click += OnMoreButtonClick;
        };
    }

    private static Button? FindMoreButton(DependencyObject element)
    {
        if (element is Button button)
        {
            return button;
        }
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(element); i++)
        {
            var found = FindMoreButton(VisualTreeHelper.GetChild(element, i));
            if (found is not null)
            {
                return found;
            }
        }
        return null;
    }

    private static async void OnMoreButtonClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button button || button.Tag is not TrackRow row)
        {
            return;
        }
        var list = FindAncestor<ListView>(button);
        var options = list is not null && MoreButtonOptions.TryGetValue(list, out var value) ? value : new MoreOptions(null, "Remove from queue", null);
        var flyout = await BuildAsync(row, options.ExtraAction, options.ExtraLabel, options.Context);
        flyout.ShowAt(button);
    }

    private static T? FindAncestor<T>(DependencyObject element) where T : DependencyObject
    {
        var current = element;
        while (current is not null)
        {
            if (current is T match)
            {
                return match;
            }
            current = VisualTreeHelper.GetParent(current);
        }
        return null;
    }

    public static async Task<MenuFlyout> BuildAsync(MediaCard card)
    {
        var flyout = new MenuFlyout();
        if (card.Kind == "track")
        {
            flyout.Items.Add(PlayItem("Play now", () => _ = Playback.PlayEntryAsync(EntryFormat.Build(card.Source, card.Type, card.Id))));
            flyout.Items.Add(QueueItem("Add to queue", () => _ = AddToQueueAsync(card)));
        }
        else
        {
            flyout.Items.Add(OpenItem("Open", () => ShellPage.NavigateDetail(card.Source, card.Type, card.Id)));
            flyout.Items.Add(QueueItem("Add to queue", () => _ = AddToQueueAsync(card)));
        }
        flyout.Items.Add(new MenuFlyoutSeparator());
        flyout.Items.Add(await PinItemAsync(card.Source, card.Type, card.Id));
        flyout.Items.Add(DownloadItem(card.Source, card.Type, card.Id));
        if (card.Source == MusicSource.Youtube)
        {
            flyout.Items.Add(CopyItem(card.Type, card.Id));
        }
        return flyout;
    }

    public static async Task<MenuFlyout> BuildAsync(TrackRow row, Action<TrackRow>? extraAction = null, string extraLabel = "Remove from queue", DetailNav? context = null)
    {
        var flyout = new MenuFlyout();
        var (source, type, id) = context is { Type: not null } && context.Type != MusicType.Track
            ? (context.Source, context.Type, context.Id)
            : (row.Source, row.Type, row.Id);
        flyout.Items.Add(PlayItem("Play now", () => _ = Playback.PlayTrackAsync(row.Payload!, source, type, id)));
        flyout.Items.Add(QueueItem("Add to queue", () => _ = AddToQueueAsync(row.Source, row.Type, row.Id)));
        if (extraAction is not null)
        {
            flyout.Items.Add(NewItem(extraLabel, "\uE74D", () => extraAction(row)));
        }
        flyout.Items.Add(new MenuFlyoutSeparator());
        flyout.Items.Add(await PinItemAsync(row.Source, row.Type, row.Id));
        flyout.Items.Add(DownloadItem(row.Source, row.Type, row.Id));
        if (row.Source == MusicSource.Youtube)
        {
            flyout.Items.Add(CopyItem(row.Type, row.Id));
        }
        return flyout;
    }

    public static void Show(MenuFlyout flyout, UIElement target, Point position)
    {
        flyout.ShowAt(target, position);
    }

    private static MenuFlyoutItem PlayItem(string text, Action action)
        => NewItem(text, "\uE768", action);

    private static MenuFlyoutItem OpenItem(string text, Action action)
        => NewItem(text, "\uE8A7", action);

    private static MenuFlyoutItem QueueItem(string text, Action action)
        => NewItem(text, "\uE8A9", action);

    private static MenuFlyoutItem NewItem(string text, string glyph, Action action)
    {
        var item = new MenuFlyoutItem { Text = text, Icon = new FontIcon { Glyph = glyph } };
        item.Click += (_, _) => action();
        return item;
    }

    private static async Task<MenuFlyoutItem> PinItemAsync(string source, string type, string id)
    {
        var isPinned = await App.Services.Pins.IsPinnedAsync(source, type, id);
        var item = new MenuFlyoutItem
        {
            Text = isPinned ? "Unpin" : "Pin",
            Icon = new FontIcon { Glyph = "\uE718" },
        };
        item.Click += async (_, _) =>
        {
            var pins = await App.Services.Pins.TogglePinAsync(source, type, id);
            item.Text = pins.Contains(PinService.EntryFor(source, type, id)) ? "Unpin" : "Pin";
        };
        return item;
    }

    private static MenuFlyoutItem DownloadItem(string source, string type, string id)
        => NewItem("Download", "\uE896", () => _ = App.Services.Downloads.AddAsync(source, type, id));

    private static MenuFlyoutItem CopyItem(string type, string id)
        => NewItem("Copy link", "\uE8C8", () =>
        {
            if (type == MusicType.Playlist)
            {
                ClipboardService.CopyPlaylist(id);
            }
            else if (type == MusicType.Artist)
            {
                ClipboardService.CopyArtist(id);
            }
            else
            {
                ClipboardService.CopyTrack(MusicSource.Youtube, id);
            }
        });

    private static async Task AddToQueueAsync(MediaCard card)
        => await AddToQueueAsync(card.Source, card.Type, card.Id);

    private static async Task AddToQueueAsync(string source, string type, string id)
    {
        try
        {
            if (type == MusicType.Track)
            {
                var queue = (await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.PlayQueue))?.ToList() ?? [];
                var entry = EntryFormat.Build(source, type, id);
                if (!queue.Contains(entry))
                {
                    queue.Add(entry);
                    await App.Services.Api.SetUserDataAsync(UserDataKeys.PlayQueue, queue.ToArray());
                }
            }
            else
            {
                await App.Services.Api.AddToBatchQueueAsync(source, type, id);
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("menu", $"add to queue failed: {ex.Message}");
        }
    }
}
