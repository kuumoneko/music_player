using KuumoApp.Controls;
using KuumoApp.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace KuumoApp.Views;

public static class MediaGrid
{
    public static async Task DefaultOpen(MediaCard card)
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

    public static Grid BuildGrid(IReadOnlyList<MediaCard> cards, Func<MediaCard, Task> onOpen, int columns = 3)
    {
        var grid = new Grid
        {
            ColumnSpacing = 12,
            RowSpacing = 12,
            Margin = new Thickness(0, 0, 0, 16),
        };
        for (var c = 0; c < columns; c++)
        {
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        }
        for (var i = 0; i < cards.Count; i++)
        {
            if (i % columns == 0)
            {
                grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            }
            var card = BuildCard(cards[i], onOpen);
            Grid.SetColumn(card, i % columns);
            Grid.SetRow(card, i / columns);
            grid.Children.Add(card);
        }
        return grid;
    }

    public static Grid BuildCard(MediaCard card, Func<MediaCard, Task> onOpen)
    {
        var image = new Image
        {
            Stretch = Stretch.UniformToFill,
        };
        ImageAttach.SetSourceUrl(image, card.Thumbnail);
        var content = new StackPanel
        {
            Spacing = 2,
            Children =
            {
                image,
                new TextBlock
                {
                    Text = card.Title,
                    FontSize = 14,
                    FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                    Margin = new Thickness(8, 6, 8, 0),
                },
                new TextBlock
                {
                    Text = card.Subtitle,
                    FontSize = 12,
                    Opacity = 0.7,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                    Margin = new Thickness(8, 0, 8, 8),
                },
            },
        };
        var border = new Border
        {
            CornerRadius = new CornerRadius(8),
            Background = (Brush)App.Current.Resources["CardBackgroundFillColorDefaultBrush"],
            Child = content,
        };
        var root = new Grid();
        root.Children.Add(border);
        root.SizeChanged += (_, _) => image.Height = Math.Min(root.ActualWidth * 9.0 / 16.0, 150);
        border.Tapped += (_, _) => _ = onOpen(card);
        border.RightTapped += async (_, args) =>
        {
            var flyout = await ItemMenu.BuildAsync(card);
            ItemMenu.Show(flyout, border, args.GetPosition(border));
        };
        CardStrip.WireHover(root, b => border.Background = b);
        return root;
    }
}
