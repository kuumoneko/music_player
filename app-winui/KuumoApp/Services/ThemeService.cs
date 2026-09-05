using System;
using System.Text.Json;
using System.Threading.Tasks;
using KuumoApp.Models;
using Microsoft.UI;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Windows.UI;
using Windows.UI.ViewManagement;

namespace KuumoApp.Services;

public enum ThemeMode
{
    System,
    Light,
    Dark,
}

public sealed class ThemeService
{
    private const string ModeKey = "themeMode";
    private const string AccentKey = "dynamicAccent";
    private const string DarkBg = "#18181b";
    private const string LightBg = "#f4f4f5";

    private readonly AppEvents _events;
    private readonly RpcClient _rpc;
    private readonly DispatcherQueue _dispatcher;
    private ThemeMode _mode = ThemeMode.System;
    private bool _dynamicAccent;
    private string? _lastUrl;
    private int _accentVersion;
    private bool _isBackground;

    public ThemeMode Mode => _mode;
    public bool DynamicAccent => _dynamicAccent;
    public bool IsBackground => _isBackground;

    public ThemeService(AppEvents events, RpcClient rpc, DispatcherQueue dispatcher)
    {
        _events = events;
        _rpc = rpc;
        _dispatcher = dispatcher;
        _events.CurrentTrackChanged += data => _ = OnTrackChangedAsync(data);
    }

    public void Start()
    {
        ApplyMode();
        _rpc.Connected += () => _dispatcher.TryEnqueue(() => _ = LoadAsync());
    }

    private async Task LoadAsync()
    {
        try
        {
            var mode = await App.Services.Api.GetUserDataAsync<string>(ModeKey) ?? "system";
            _mode = mode switch
            {
                "dark" => ThemeMode.Dark,
                "light" => ThemeMode.Light,
                _ => ThemeMode.System,
            };
            _dynamicAccent = ParseAccentFlag(await App.Services.Api.GetUserDataAsync<JsonElement?>(AccentKey));
            ApplyMode();
            var current = await App.Services.Api.GetCurrentPlayingAsync();
            if (current is not null && !string.IsNullOrEmpty(current.Id))
            {
                SetTrackId(current.Id);
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("theme", $"load failed: {ex.GetType().Name}: {ex.Message}");
        }
    }

    public void SetMode(string mode)
    {
        _mode = mode switch
        {
            "dark" => ThemeMode.Dark,
            "light" => ThemeMode.Light,
            _ => ThemeMode.System,
        };
        ApplyMode();
    }

    public void SetDynamicAccent(bool enabled)
    {
        _dynamicAccent = enabled;
        _accentVersion++;
        _ = ApplyAccentAsync();
    }

    private static readonly string[] TextBrushKeys = { "TextFillColorPrimaryBrush", "TextFillColorSecondaryBrush", "TextFillColorTertiaryBrush" };

    private readonly Dictionary<(string Theme, string Key), Color> _originalTextColors = new();
    private bool _originalsCaptured;

    public void ApplyMode()
    {
        var element = App.MainWindow?.Content as FrameworkElement;
        if (element is null)
        {
            return;
        }
        element.RequestedTheme = _mode switch
        {
            ThemeMode.Light => ElementTheme.Light,
            ThemeMode.Dark => ElementTheme.Dark,
            _ => ElementTheme.Default,
        };
        _ = ApplyAccentAsync();
    }

    private void SetTrackId(string id)
    {
        var url = $"https://i.ytimg.com/vi/{id}/default.jpg";
        if (url == _lastUrl)
        {
            return;
        }
        _lastUrl = url;
        _accentVersion++;
        _ = ApplyAccentAsync();
    }

    private Task OnTrackChangedAsync(CurrentTrackChangedDto data)
    {
        if (_isBackground)
        {
            return Task.CompletedTask;
        }
        SetTrackId(data.Id);
        return Task.CompletedTask;
    }

    public void SetBackground(bool isBackground)
    {
        _isBackground = isBackground;
    }

    private async Task ApplyAccentAsync()
    {
        var version = _accentVersion;
        if (!_dynamicAccent || string.IsNullOrEmpty(_lastUrl))
        {
            ResetAccent();
            return;
        }
        try
        {
            var dataUri = await App.Services.Api.GetImageDataUriAsync(_lastUrl);
            if (version != _accentVersion)
            {
                return;
            }
            if (string.IsNullOrEmpty(dataUri))
            {
                ResetAccent();
                return;
            }
            var color = await AccentColorUtils.ExtractDominantColorAsync(dataUri);
            if (version != _accentVersion)
            {
                return;
            }
            if (color is null)
            {
                ResetAccent();
                return;
            }
            var bg = IsDark() ? DarkBg : LightBg;
            var adjusted = AccentColorUtils.EnsureContrast(color, bg, 4.5);
            ApplyAccentColors(adjusted);
            AppLog.Write("theme", $"accent applied: {adjusted} (bg {bg})");
        }
        catch (Exception ex)
        {
            AppLog.Write("theme", $"accent failed: {ex.Message}");
            ResetAccent();
        }
    }

    public static bool ParseAccentFlag(JsonElement? el)
    {
        if (el is not { } e)
        {
            return false;
        }
        return e.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.String => e.GetString() == "true",
            _ => false,
        };
    }

    private void ApplyAccentColors(string hex)
    {
        var (r, g, b) = AccentColorUtils.HexToRgb(hex);
        var text = AccentColorUtils.Luminance(r, g, b) > 0.5 ? AccentColorUtils.HexToColor("#18181b") : Colors.White;
        var accent = AccentColorUtils.HexToColor(hex);
        SetBrush("AppAccentBrush", accent);
        SetBrush("AppAccentHoverBrush", AccentColorUtils.HexToColor(AccentColorUtils.Darken(hex, 0.2)));
        SetBrush("AppAccentTextBrush", text);
        CaptureOriginals();
        var darkSecondary = AccentColorUtils.HexToColor(AccentColorUtils.Darken(hex, 0.15));
        var lightSecondary = AccentColorUtils.HexToColor(AccentColorUtils.Lighten(hex, 0.3));
        var darkTertiary = AccentColorUtils.HexToColor(AccentColorUtils.Darken(hex, 0.3));
        var lightTertiary = AccentColorUtils.HexToColor(AccentColorUtils.Lighten(hex, 0.5));
        SetThemeText("Dark", "TextFillColorPrimaryBrush", accent);
        SetThemeText("Dark", "TextFillColorSecondaryBrush", darkSecondary);
        SetThemeText("Dark", "TextFillColorTertiaryBrush", darkTertiary);
        SetThemeText("Light", "TextFillColorPrimaryBrush", accent);
        SetThemeText("Light", "TextFillColorSecondaryBrush", lightSecondary);
        SetThemeText("Light", "TextFillColorTertiaryBrush", lightTertiary);
    }

    private void ResetAccent()
    {
        SetBrush("AppAccentBrush", ThemeBrushColor("AccentFillColorDefaultBrush") ?? SystemAccent());
        SetBrush("AppAccentHoverBrush", ThemeBrushColor("AccentFillColorSecondaryBrush") ?? SystemAccent());
        SetBrush("AppAccentTextBrush", ThemeBrushColor("AccentTextFillColorPrimaryBrush") ?? Colors.White);
        CaptureOriginals();
        foreach (var kvp in _originalTextColors)
        {
            SetThemeText(kvp.Key.Theme, kvp.Key.Key, kvp.Value);
        }
    }

    private void CaptureOriginals()
    {
        if (_originalsCaptured)
        {
            return;
        }
        foreach (var theme in new[] { "Dark", "Light" })
        {
            foreach (var key in TextBrushKeys)
            {
                if (ThemeBrush(theme, key) is { } brush)
                {
                    _originalTextColors[(theme, key)] = brush.Color;
                }
            }
        }
        _originalsCaptured = true;
    }

    private void SetThemeText(string theme, string key, Color color)
    {
        if (ThemeBrush(theme, key) is { } brush)
        {
            brush.Color = color;
        }
    }

    private static SolidColorBrush? ThemeBrush(string theme, string key)
    {
        return Application.Current.Resources.ThemeDictionaries.TryGetValue(theme, out var dictObj)
            && dictObj is ResourceDictionary dict
            && dict.TryGetValue(key, out var value)
            && value is SolidColorBrush brush
            ? brush
            : null;
    }

    private static void SetBrush(string key, Color color)
    {
        if (Application.Current.Resources.TryGetValue(key, out var value) && value is SolidColorBrush brush)
        {
            brush.Color = color;
        }
    }

    private static Color? ThemeBrushColor(string key)
    {
        return Application.Current.Resources.TryGetValue(key, out var value) && value is SolidColorBrush brush
            ? brush.Color
            : null;
    }

    private static Color SystemAccent()
    {
        try
        {
            return new UISettings().GetColorValue(UIColorType.Accent);
        }
        catch
        {
            return Colors.DodgerBlue;
        }
    }

    private static bool SystemIsDark()
    {
        try
        {
            var bg = new UISettings().GetColorValue(UIColorType.Background);
            return AccentColorUtils.Luminance(bg.R, bg.G, bg.B) < 0.5;
        }
        catch
        {
            return false;
        }
    }

    private bool IsDark()
    {
        if (_mode == ThemeMode.Dark)
        {
            return true;
        }
        if (_mode == ThemeMode.Light)
        {
            return false;
        }
        return SystemIsDark();
    }
}
