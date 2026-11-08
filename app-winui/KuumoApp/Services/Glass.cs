using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;

namespace KuumoApp.Services;

/// <summary>
/// Resolves theme-aware glass brushes from code. Card/grid builders cannot use
/// {ThemeResource}, so they call this instead; keys live in Views/Glass.xaml.
/// </summary>
public static class Glass
{
    public static Brush Resolve(string key, DependencyObject? from = null)
    {
        if (Application.Current.Resources.TryGetValue(key, out var value) && value is Brush brush)
        {
            return brush;
        }
        var theme = (from as FrameworkElement)?.ActualTheme ?? ElementTheme.Dark;
        var themeKey = theme == ElementTheme.Light ? "Light" : "Dark";
        if (Application.Current.Resources.ThemeDictionaries.TryGetValue(themeKey, out var dictObj)
            && dictObj is ResourceDictionary dict
            && dict.TryGetValue(key, out var themed)
            && themed is Brush themedBrush)
        {
            return themedBrush;
        }
        if (Application.Current.Resources.TryGetValue("CardBackgroundFillColorDefaultBrush", out var fallback)
            && fallback is Brush fallbackBrush)
        {
            return fallbackBrush;
        }
        return new SolidColorBrush(Microsoft.UI.Colors.Transparent);
    }
}
