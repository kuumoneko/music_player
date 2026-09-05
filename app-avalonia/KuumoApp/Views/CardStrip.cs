using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using KuumoApp.Controls;
using KuumoApp.Services;

namespace KuumoApp.Views;

public static class CardStrip
{
    public static HorizontalStrip Build(IEnumerable<MediaCard> items, Func<MediaCard, Task> onOpen)
    {
        var strip = new HorizontalStrip
        {
            Margin = new Thickness(0, 0, 0, 8),
        };
        foreach (var card in items)
        {
            var imageBorder = new Border
            {
                CornerRadius = new CornerRadius(6),
                ClipToBounds = true,
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Top,
                Child = new Image
                {
                    Stretch = Stretch.UniformToFill,
                    HorizontalAlignment = HorizontalAlignment.Stretch,
                    VerticalAlignment = VerticalAlignment.Top,
                },
            };
            ImageHelper.SetSourceUrl((Image)imageBorder.Child!, card.Thumbnail);

            var titleBlock = new TextBlock
            {
                Text = card.Title,
                FontSize = 13,
                FontWeight = FontWeight.SemiBold,
                TextTrimming = TextTrimming.CharacterEllipsis,
                Margin = new Thickness(0, 4, 0, 0),
            };

            var subtitleBlock = new TextBlock
            {
                Text = card.Subtitle,
                FontSize = 11,
                Opacity = 0.7,
                TextTrimming = TextTrimming.CharacterEllipsis,
            };

            var content = new StackPanel
            {
                Spacing = 2,
                Children =
                {
                    imageBorder,
                    titleBlock,
                    subtitleBlock,
                },
            };

            var cardRoot = new Border
            {
                Background = ResourceHelper.FindBrush("CardBackgroundFillColorDefaultBrush"),
                CornerRadius = new CornerRadius(8),
                Child = content,
                Margin = new Thickness(0, 0, 0, 4),
            };
            var target = card;
            cardRoot.PointerPressed += async (_, e) =>
            {
                if (strip.IsDragging) return;
                if (e.GetCurrentPoint(cardRoot).Properties.IsLeftButtonPressed)
                {
                    await onOpen(target);
                }
                else if (e.GetCurrentPoint(cardRoot).Properties.IsRightButtonPressed)
                {
                    var menu = ItemMenu.Build(target);
                    menu.Open(cardRoot);
                }
            };
            strip.AddCard(cardRoot);
        }
        return strip;
    }

    public static void WireHover(Panel overlayHost, Action<IBrush> setBackground, Func<bool>? suppress = null)
    {
        var baseBrush = ResourceHelper.FindBrush("CardBackgroundFillColorDefaultBrush");
        var hoverBrush = ResourceHelper.FindBrush("CardBackgroundFillColorSecondaryBrush");
        var overlay = new Border
        {
            CornerRadius = new CornerRadius(8),
            Background = new SolidColorBrush(Colors.Black),
            Opacity = 0,
            IsHitTestVisible = false,
        };
        overlayHost.Children.Add(overlay);
        overlayHost.PointerEntered += (_, _) =>
        {
            if (suppress?.Invoke() == true) return;
            if (hoverBrush is not null) setBackground(hoverBrush);
        };
        overlayHost.PointerExited += (_, _) =>
        {
            if (baseBrush is not null) setBackground(baseBrush);
            overlay.Opacity = 0;
        };
        overlayHost.PointerPressed += (_, _) => overlay.Opacity = 0.35;
        overlayHost.PointerReleased += (_, _) => overlay.Opacity = 0;
        overlayHost.PointerCaptureLost += (_, _) =>
        {
            if (baseBrush is not null) setBackground(baseBrush);
            overlay.Opacity = 0;
        };
    }
}