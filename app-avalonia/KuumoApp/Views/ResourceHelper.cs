using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;

namespace KuumoApp.Views;

public static class ResourceHelper
{
    public static IBrush? FindBrush(string key, IBrush? fallback = null)
    {
        if (Application.Current?.TryFindResource(key, null, out var value) == true && value is IBrush brush)
        {
            return brush;
        }
        return fallback;
    }
}