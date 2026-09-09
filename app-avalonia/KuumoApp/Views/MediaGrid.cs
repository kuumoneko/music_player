using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public static class MediaGrid
{
    public static async Task DefaultOpen(MediaCard card)
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

    public static Panel BuildGrid(IReadOnlyList<MediaCard> cards, Func<MediaCard, Task> onOpen, double availableWidth = 0)
    {
        const double spacing = 12;
        const double targetCardWidth = 172;
        const double minCardWidth = 140;

        double cardWidth;
        if (availableWidth > 0)
        {
            var cols = Math.Max(1, (int)Math.Floor((availableWidth + spacing) / (targetCardWidth + spacing)));
            cardWidth = (availableWidth - (cols - 1) * spacing) / cols;
            cardWidth = Math.Max(minCardWidth, cardWidth);
        }
        else
        {
            cardWidth = targetCardWidth;
        }

        var imageWidth = cardWidth;
        var imageHeight = imageWidth * 9.0 / 16.0;

        var panel = new WrapPanel
        {
            Margin = new Thickness(0, 0, 0, 16),
        };
        foreach (var card in cards)
        {
            var cardControl = BuildCard(card, onOpen, cardWidth, imageWidth, imageHeight);
            panel.Children.Add(cardControl);
        }
        return panel;
    }

    public static Border BuildCard(MediaCard card, Func<MediaCard, Task> onOpen, double cardWidth = 172, double imageWidth = 160, double imageHeight = 90)
    {
        var image = new Image
        {
            Stretch = Stretch.UniformToFill,
            Width = imageWidth,
            Height = imageHeight,
        };
        ImageHelper.SetSourceUrl(image, card.Thumbnail);

        var imageBorder = new Border
        {
            Width = imageWidth,
            Height = imageHeight,
            CornerRadius = new CornerRadius(6),
            ClipToBounds = true,
            Child = image,
        };

        var content = new StackPanel
        {
            Spacing = 2,
            Children =
            {
                imageBorder,
                new TextBlock
                {
                    Text = card.Title,
                    FontSize = 13,
                    FontWeight = FontWeight.SemiBold,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                    Margin = new Thickness(0, 4, 0, 0),
                },
                new TextBlock
                {
                    Text = card.Subtitle,
                    FontSize = 11,
                    Opacity = 0.7,
                    TextTrimming = TextTrimming.CharacterEllipsis,
                },
            },
        };
        var border = new Border
        {
            CornerRadius = new CornerRadius(8),
            Background = ResourceHelper.FindBrush("CardBackgroundFillColorDefaultBrush"),
            Child = content,
            Width = cardWidth,
            Margin = new Thickness(0, 0, 12, 12),
        };
        border.PointerPressed += async (_, e) =>
        {
            if (e.GetCurrentPoint(border).Properties.IsLeftButtonPressed)
            {
                await onOpen(card);
            }
            else if (e.GetCurrentPoint(border).Properties.IsRightButtonPressed)
            {
                var menu = ItemMenu.Build(card);
                menu.Open(border);
            }
        };
        border.PointerEntered += (_, _) =>
        {
            border.Background = ResourceHelper.FindBrush("CardBackgroundFillColorSecondaryBrush")
                                ?? new SolidColorBrush(Colors.Gray) { Opacity = 0.1 };
        };
        border.PointerExited += (_, _) =>
        {
            border.Background = ResourceHelper.FindBrush("CardBackgroundFillColorDefaultBrush");
        };
        return border;
    }
}