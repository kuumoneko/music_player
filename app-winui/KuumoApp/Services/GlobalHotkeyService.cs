using System.Runtime.InteropServices;
using Microsoft.UI.Xaml;
using WinRT.Interop;

namespace KuumoApp.Services;

public sealed class GlobalHotkeyService : IDisposable
{
    private const uint WM_HOTKEY = 0x0312;
    private const uint MOD_ALT = 0x0001;
    private const uint MOD_CONTROL = 0x0002;
    private const uint MOD_SHIFT = 0x0004;
    private const uint MOD_NOREPEAT = 0x4000;

    // Virtual-Key codes
    private const uint VK_SPACE = 0x20;
    private const uint VK_LEFT = 0x25;
    private const uint VK_UP = 0x26;
    private const uint VK_RIGHT = 0x27;
    private const uint VK_DOWN = 0x28;
    private const uint VK_M = 0x4D;
    private const uint VK_MEDIA_NEXT_TRACK = 0xB0;
    private const uint VK_MEDIA_PREV_TRACK = 0xB1;
    private const uint VK_MEDIA_STOP = 0xB2;
    private const uint VK_MEDIA_PLAY_PAUSE = 0xB3;

    private enum HotkeyId
    {
        MediaPlayPause = 9001,
        MediaNext = 9002,
        MediaPrev = 9003,
        MediaStop = 9004,
        ComboPlayPause = 9010,
        ComboNext = 9011,
        ComboPrev = 9012,
        ComboVolUp = 9013,
        ComboVolDown = 9014,
        ComboMute = 9015,
    }

    private readonly Window _window;
    private IntPtr _hwnd;
    private SubclassProc? _subclassProc;
    private readonly List<int> _registeredHotkeys = [];
    private bool _initialized;
    private bool _disposed;
    private int _cachedVolume = 50;

    private const nuint SubclassId = 101;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("comctl32.dll", SetLastError = true)]
    private static extern bool SetWindowSubclass(IntPtr hWnd, SubclassProc pfnSubclass, nuint uIdSubclass, nuint dwRefData);

    [DllImport("comctl32.dll", SetLastError = true)]
    private static extern bool RemoveWindowSubclass(IntPtr hWnd, SubclassProc pfnSubclass, nuint uIdSubclass);

    [DllImport("comctl32.dll")]
    private static extern IntPtr DefSubclassProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam);

    private delegate IntPtr SubclassProc(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam, nuint uIdSubclass, nuint dwRefData);

    public GlobalHotkeyService(Window window)
    {
        _window = window;
    }

    public void Initialize()
    {
        if (_initialized || _disposed) return;
        _initialized = true;

        _hwnd = WindowNative.GetWindowHandle(_window);
        if (_hwnd == IntPtr.Zero)
        {
            AppLog.Write("hotkey", "failed to obtain hwnd for global hotkeys");
            return;
        }

        _subclassProc = OnSubclassMessage;
        if (!SetWindowSubclass(_hwnd, _subclassProc, SubclassId, 0))
        {
            AppLog.Write("hotkey", "failed to set window subclass");
            return;
        }

        App.Services.Events.SettingsChanged += OnSettingsChanged;

        // 1. Hardware media keys (no modifiers, MOD_NOREPEAT)
        Register((int)HotkeyId.MediaPlayPause, MOD_NOREPEAT, VK_MEDIA_PLAY_PAUSE);
        Register((int)HotkeyId.MediaNext, MOD_NOREPEAT, VK_MEDIA_NEXT_TRACK);
        Register((int)HotkeyId.MediaPrev, MOD_NOREPEAT, VK_MEDIA_PREV_TRACK);
        Register((int)HotkeyId.MediaStop, MOD_NOREPEAT, VK_MEDIA_STOP);

        // 2. Global combo hotkeys (Ctrl + Alt + [Key]) for users without dedicated media keys
        const uint comboMod = MOD_CONTROL | MOD_ALT | MOD_NOREPEAT;
        Register((int)HotkeyId.ComboPlayPause, comboMod, VK_SPACE);
        Register((int)HotkeyId.ComboNext, comboMod, VK_RIGHT);
        Register((int)HotkeyId.ComboPrev, comboMod, VK_LEFT);
        Register((int)HotkeyId.ComboVolUp, comboMod, VK_UP);
        Register((int)HotkeyId.ComboVolDown, comboMod, VK_DOWN);
        Register((int)HotkeyId.ComboMute, comboMod, VK_M);

        AppLog.Write("hotkey", $"registered {_registeredHotkeys.Count} global hotkeys");
    }

    private void Register(int id, uint modifiers, uint vk)
    {
        if (RegisterHotKey(_hwnd, id, modifiers, vk))
        {
            _registeredHotkeys.Add(id);
        }
        else
        {
            var error = Marshal.GetLastWin32Error();
            AppLog.Write("hotkey", $"failed to register hotkey {id} (vk:0x{vk:X2}): win32 error {error}");
        }
    }

    private void OnSettingsChanged(Models.SettingsChangedDto dto)
    {
        _cachedVolume = dto.Volume;
    }

    private IntPtr OnSubclassMessage(IntPtr hWnd, uint uMsg, IntPtr wParam, IntPtr lParam, nuint uIdSubclass, nuint dwRefData)
    {
        if (uMsg == WM_HOTKEY)
        {
            var id = wParam.ToInt32();
            HandleHotkey(id);
            return IntPtr.Zero;
        }
        return DefSubclassProc(hWnd, uMsg, wParam, lParam);
    }

    private void HandleHotkey(int id)
    {
        try
        {
            switch ((HotkeyId)id)
            {
                case HotkeyId.MediaPlayPause:
                case HotkeyId.ComboPlayPause:
                    AppLog.Write("hotkey", "trigger: toggle play/pause");
                    _ = App.Services.Api.TogglePlayPauseAsync();
                    break;
                case HotkeyId.MediaNext:
                case HotkeyId.ComboNext:
                    AppLog.Write("hotkey", "trigger: next track");
                    _ = App.Services.Api.NextAsync();
                    break;
                case HotkeyId.MediaPrev:
                case HotkeyId.ComboPrev:
                    AppLog.Write("hotkey", "trigger: previous track");
                    _ = App.Services.Api.PreviousAsync();
                    break;
                case HotkeyId.MediaStop:
                    AppLog.Write("hotkey", "trigger: stop");
                    _ = App.Services.Api.TogglePlayPauseAsync();
                    break;
                case HotkeyId.ComboVolUp:
                    AdjustVolume(5);
                    break;
                case HotkeyId.ComboVolDown:
                    AdjustVolume(-5);
                    break;
                case HotkeyId.ComboMute:
                    ToggleMute();
                    break;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("hotkey", $"error handling hotkey {id}: {ex.Message}");
        }
    }

    private void AdjustVolume(int delta)
    {
        _cachedVolume = Math.Clamp(_cachedVolume + delta, 0, 100);
        AppLog.Write("hotkey", $"trigger: volume -> {_cachedVolume}%");
        _ = App.Services.Api.SetUserDataAsync("volume", _cachedVolume);
    }

    private void ToggleMute()
    {
        var newVol = _cachedVolume > 0 ? 0 : 50;
        _cachedVolume = newVol;
        AppLog.Write("hotkey", $"trigger: mute toggle -> {_cachedVolume}%");
        _ = App.Services.Api.SetUserDataAsync("volume", _cachedVolume);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        if (_hwnd != IntPtr.Zero)
        {
            foreach (var id in _registeredHotkeys)
            {
                UnregisterHotKey(_hwnd, id);
            }
            _registeredHotkeys.Clear();

            if (_subclassProc != null)
            {
                RemoveWindowSubclass(_hwnd, _subclassProc, SubclassId);
                _subclassProc = null;
            }
            _hwnd = IntPtr.Zero;
        }

        App.Services.Events.SettingsChanged -= OnSettingsChanged;
    }
}
