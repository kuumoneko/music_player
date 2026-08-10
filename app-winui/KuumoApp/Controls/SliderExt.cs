using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Media;

namespace KuumoApp.Controls;

public static class SliderExt
{
    public static void HookThumbDrag(
        Slider slider,
        DragStartedEventHandler onStarted,
        DragCompletedEventHandler onCompleted)
    {
        slider.Loaded += (_, _) =>
        {
            var thumb = FindThumb(slider);
            if (thumb is not null)
            {
                thumb.DragStarted += onStarted;
                thumb.DragCompleted += onCompleted;
            }
        };
    }

    private static Thumb? FindThumb(DependencyObject root)
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
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
