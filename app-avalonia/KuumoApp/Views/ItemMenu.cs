using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public static class ItemMenu
{
    public static ContextMenu Build(MediaCard card)
    {
        var menu = new ContextMenu();
        if (card.Kind == "track")
        {
            menu.Items.Add(MenuItem("Play now", "\uE768", () => _ = Playback.PlayEntryAsync($"{card.Source}:{card.Type}:{card.Id}")));
            menu.Items.Add(MenuItem("Add to queue", "\uE8A9", () => _ = AddToQueueAsync(card)));
        }
        else
        {
            menu.Items.Add(MenuItem("Open", "\uE8A7", () => ShellPage.NavigateDetail(card.Source, card.Type, card.Id)));
            menu.Items.Add(MenuItem("Add to queue", "\uE8A9", () => _ = AddToQueueAsync(card)));
        }
        menu.Items.Add(new Separator());
        menu.Items.Add(PinMenuItem(card.Source, card.Type, card.Id));
        menu.Items.Add(MenuItem("Download", "\uE896", () => _ = new DownloadQueueService().AddAsync(card.Source, card.Type, card.Id)));
        if (card.Source == MusicSource.Youtube)
        {
            menu.Items.Add(CopyMenuItem(card.Type, card.Id));
        }
        return menu;
    }

    public static ContextMenu Build(TrackRow row, Action<TrackRow>? extraAction = null, string extraLabel = "Remove from queue", DetailNav? context = null)
    {
        var menu = new ContextMenu();
        var (source, type, id) = context is { Type: not null } && context.Type != MusicType.Track
            ? (context.Source, context.Type, context.Id)
            : (row.Source, row.Type, row.Id);
        menu.Items.Add(MenuItem("Play now", "\uE768", () => _ = Playback.PlayTrackAsync(row.Payload!, source, type, id)));
        menu.Items.Add(MenuItem("Add to queue", "\uE8A9", () => _ = AddToQueueAsync(row.Source, row.Type, row.Id)));
        if (extraAction is not null)
        {
            menu.Items.Add(MenuItem(extraLabel, "\uE74D", () => extraAction(row)));
        }
        menu.Items.Add(new Separator());
        menu.Items.Add(PinMenuItem(row.Source, row.Type, row.Id));
        menu.Items.Add(MenuItem("Download", "\uE896", () => _ = new DownloadQueueService().AddAsync(row.Source, row.Type, row.Id)));
        if (row.Source == MusicSource.Youtube)
        {
            menu.Items.Add(CopyMenuItem(row.Type, row.Id));
        }
        return menu;
    }

    public static void Show(ContextMenu menu, Control target)
    {
        menu.Open(target);
    }

    private static MenuItem MenuItem(string text, string glyph, Action action)
    {
        var item = new MenuItem
        {
            Header = text,
            Icon = new TextBlock
            {
                Text = glyph,
                FontFamily = new FontFamily("Segoe MDL2 Assets"),
                FontSize = 14,
            }
        };
        item.Click += (_, _) => action();
        return item;
    }

    private static MenuItem PinMenuItem(string source, string type, string id)
    {
        var service = new PinService();
        var icon = new TextBlock
        {
            Text = "\uE718",
            FontFamily = new FontFamily("Segoe MDL2 Assets"),
            FontSize = 14,
        };
        var item = new MenuItem
        {
            Header = "Pin",
            Icon = icon,
        };
        _ = LoadPinStateAsync(item, icon, service, source, type, id);
        item.Click += async (_, _) =>
        {
            var pins = await service.TogglePinAsync(source, type, id);
            var isPinned = pins.Contains(PinService.EntryFor(source, type, id));
            item.Header = isPinned ? "Unpin" : "Pin";
            icon.Text = isPinned ? "\uE840" : "\uE718";
        };
        return item;
    }

    private static async System.Threading.Tasks.Task LoadPinStateAsync(MenuItem item, TextBlock icon, PinService service, string source, string type, string id)
    {
        var isPinned = await service.IsPinnedAsync(source, type, id);
        item.Header = isPinned ? "Unpin" : "Pin";
        icon.Text = isPinned ? "\uE840" : "\uE718";
    }

    private static MenuItem CopyMenuItem(string type, string id)
        => MenuItem("Copy link", "\uE8C8", () =>
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

    private static async System.Threading.Tasks.Task AddToQueueAsync(MediaCard card)
        => await AddToQueueAsync(card.Source, card.Type, card.Id);

    private static async System.Threading.Tasks.Task AddToQueueAsync(string source, string type, string id)
    {
        try
        {
            if (type == MusicType.Track)
            {
                var queue = (await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.PlayQueue))?.ToList() ?? [];
                var entry = $"{source}:{type}:{id}";
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