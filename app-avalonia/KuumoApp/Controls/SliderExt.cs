using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.VisualTree;

namespace KuumoApp.Controls;

public static class SliderExt
{
    public static void HookThumbDrag(
        Slider slider,
        EventHandler<Avalonia.Input.PointerPressedEventArgs>? onStarted,
        EventHandler<Avalonia.Input.PointerReleasedEventArgs>? onCompleted)
    {
        slider.AttachedToVisualTree += (_, _) =>
        {
            var thumb = FindThumb(slider);
            if (thumb is not null)
            {
                if (onStarted is not null) thumb.PointerPressed += onStarted;
                if (onCompleted is not null) thumb.PointerReleased += onCompleted;
            }
        };
    }

    private static Thumb? FindThumb(Avalonia.Visual root)
    {
        foreach (var child in root.GetVisualChildren())
        {
            if (child is Thumb thumb)
            {
                return thumb;
            }
            var nested = FindThumb(child);
            if (nested is not null)
            {
                return nested;
            }
        }
        return null;
    }
}