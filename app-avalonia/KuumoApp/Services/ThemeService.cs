using System.Runtime.InteropServices;
using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Styling;
using Avalonia.Threading;
using KuumoApp.Models;

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

    private static readonly string[] TextBrushKeys = ["TextFillColorPrimaryBrush", "TextFillColorSecondaryBrush", "TextFillColorTertiaryBrush"];

    private readonly AppEvents _events;
    private readonly RpcClient _rpc;
    private ThemeMode _mode = ThemeMode.System;
    private bool _dynamicAccent;
    private string? _lastUrl;
    private int _accentVersion;
    private bool _isBackground;

    private readonly Dictionary<(string Theme, string Key), Color> _originalTextColors = new();
    private bool _originalsCaptured;

    public ThemeMode Mode => _mode;
    public bool DynamicAccent => _dynamicAccent;

    public ThemeService(AppEvents events, RpcClient rpc)
    {
        _events = events;
        _rpc = rpc;
        _events.CurrentTrackChanged += data => _ = OnTrackChangedAsync(data);
    }

    public void Start()
    {
        ApplyMode();
        _rpc.Connected += () => Dispatcher.UIThread.Post(() => _ = LoadAsync());
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

    public void ApplyMode()
    {
        if (Application.Current is null)
        {
            return;
        }
        Application.Current.RequestedThemeVariant = _mode switch
        {
            ThemeMode.Light => ThemeVariant.Light,
            ThemeMode.Dark => ThemeVariant.Dark,
            _ => ThemeVariant.Default,
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
            string? dataUri = null;
            if (!ImageCache.TryGet(_lastUrl, out _))
            {
                dataUri = await App.Services.Api.GetImageDataUriAsync(_lastUrl);
            }
            if (version != _accentVersion)
            {
                return;
            }
            if (string.IsNullOrEmpty(dataUri))
            {
                if (!ImageCache.TryGet(_lastUrl, out _))
                {
                    ResetAccent();
                    return;
                }
            }
            if (dataUri is not null)
            {
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
        var text = AccentColorUtils.Luminance(r, g, b) > 0.5
            ? Avalonia.Media.Color.Parse("#18181b")
            : Avalonia.Media.Colors.White;
        var accent = Avalonia.Media.Color.Parse(hex);
        var hover = Avalonia.Media.Color.Parse(AccentColorUtils.Darken(hex, 0.2));

        SetResource("AppAccentBrush", new SolidColorBrush(accent));
        SetResource("AppAccentHoverBrush", new SolidColorBrush(hover));
        SetResource("AppAccentTextBrush", new SolidColorBrush(text));

        CaptureOriginals();
        var darkSecondary = Avalonia.Media.Color.Parse(AccentColorUtils.Darken(hex, 0.15));
        var lightSecondary = Avalonia.Media.Color.Parse(AccentColorUtils.Lighten(hex, 0.3));
        var darkTertiary = Avalonia.Media.Color.Parse(AccentColorUtils.Darken(hex, 0.3));
        var lightTertiary = Avalonia.Media.Color.Parse(AccentColorUtils.Lighten(hex, 0.5));
        SetThemeText("Dark", "TextFillColorPrimaryBrush", accent);
        SetThemeText("Dark", "TextFillColorSecondaryBrush", darkSecondary);
        SetThemeText("Dark", "TextFillColorTertiaryBrush", darkTertiary);
        SetThemeText("Light", "TextFillColorPrimaryBrush", accent);
        SetThemeText("Light", "TextFillColorSecondaryBrush", lightSecondary);
        SetThemeText("Light", "TextFillColorTertiaryBrush", lightTertiary);
    }

    private void ResetAccent()
    {
        var accent = Avalonia.Media.Color.Parse(SystemAccentHex());
        var hover = Avalonia.Media.Color.Parse(AccentColorUtils.Darken(SystemAccentHex(), 0.2));
        var text = Avalonia.Media.Colors.White;

        SetResource("AppAccentBrush", new SolidColorBrush(accent));
        SetResource("AppAccentHoverBrush", new SolidColorBrush(hover));
        SetResource("AppAccentTextBrush", new SolidColorBrush(text));

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
                if (TryFindThemeBrush(theme, key) is { } brush)
                {
                    _originalTextColors[(theme, key)] = brush.Color;
                }
            }
        }
        _originalsCaptured = true;
    }

    private static void SetThemeText(string theme, string key, Color color)
    {
        if (TryFindThemeBrush(theme, key) is { } brush)
        {
            brush.Color = color;
        }
    }

    private static SolidColorBrush? TryFindThemeBrush(string theme, string key)
    {
        if (Application.Current is null) return null;
        var variant = theme == "Dark" ? ThemeVariant.Dark : ThemeVariant.Light;
        if (Application.Current.TryFindResource(key, variant, out var value) && value is SolidColorBrush brush)
        {
            return brush;
        }
        return null;
    }

    private static void SetResource(string key, object value)
    {
        if (Application.Current is not null)
        {
            Application.Current.Resources[key] = value;
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

    private static string SystemAccentHex()
    {
        try
        {
            var (r, g, b) = GetSystemAccentRgb();
            return $"#{r:X2}{g:X2}{b:X2}";
        }
        catch
        {
            return "#6366f1";
        }
    }

    private static bool SystemIsDark()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            var value = key?.GetValue("AppsUseLightTheme");
            if (value is int intValue)
            {
                return intValue == 0;
            }
        }
        catch
        {
        }
        return false;
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetColorizationColor(out uint colorizationColor, out bool opaqueBlend);

    private static (byte R, byte G, byte B) GetSystemAccentRgb()
    {
        try
        {
            var hr = DwmGetColorizationColor(out var color, out _);
            if (hr == 0)
            {
                var r = (byte)((color >> 16) & 0xFF);
                var g = (byte)((color >> 8) & 0xFF);
                var b = (byte)(color & 0xFF);
                return (r, g, b);
            }
        }
        catch
        {
        }
        return (0x63, 0x66, 0xf1);
    }
}