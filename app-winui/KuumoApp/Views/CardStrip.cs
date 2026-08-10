using KuumoApp.Controls;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace KuumoApp.Views;

public static class CardStrip
{
    public static HorizontalStrip Build(IEnumerable<MediaCard> items, Func<MediaCard, Task> onOpen)
    {
        var strip = new HorizontalStrip
        {
            Height = 200,
            Margin = new Thickness(0, 0, 0, 8),
        };
        var template = (DataTemplate)App.Current.Resources["CardTemplate"];
        foreach (var card in items)
        {
            var cardRoot = template.LoadContent() as Grid;
            if (cardRoot is null)
            {
                continue;
            }
            cardRoot.DataContext = card;
            var target = card;
            cardRoot.Tapped += (_, _) =>
            {
                if (strip.IsDragging)
                {
                    return;
                }
                _ = onOpen(target);
            };
            cardRoot.RightTapped += async (_, args) =>
            {
                if (strip.IsDragging)
                {
                    return;
                }
                var flyout = await ItemMenu.BuildAsync(target);
                ItemMenu.Show(flyout, cardRoot, args.GetPosition(cardRoot));
            };
            WireHover(cardRoot, b => cardRoot.Background = b, () => strip.IsDragging);
            strip.AddCard(cardRoot);
        }
        return strip;
    }

    public static void WireHover(Grid overlayHost, Action<Brush> setBackground, Func<bool>? suppress = null)
    {
        var baseBrush = (Brush)App.Current.Resources["CardBackgroundFillColorDefaultBrush"];
        var hoverBrush = (Brush)App.Current.Resources["CardBackgroundFillColorSecondaryBrush"];
        var overlay = new Border
        {
            CornerRadius = new CornerRadius(8),
            Background = new SolidColorBrush(Microsoft.UI.Colors.Black),
            Opacity = 0,
            IsHitTestVisible = false,
        };
        overlayHost.Children.Add(overlay);
        overlayHost.PointerEntered += (_, _) =>
        {
            if (suppress?.Invoke() == true)
            {
                return;
            }
            setBackground(hoverBrush);
        };
        overlayHost.PointerExited += (_, _) =>
        {
            setBackground(baseBrush);
            overlay.Opacity = 0;
        };
        overlayHost.PointerPressed += (_, _) => overlay.Opacity = 0.35;
        overlayHost.PointerReleased += (_, _) => overlay.Opacity = 0;
        overlayHost.PointerCaptureLost += (_, _) =>
        {
            setBackground(baseBrush);
            overlay.Opacity = 0;
        };
    }
}
