using System.Text.Json;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Windows.Graphics;

namespace KuumoApp.Services;

public sealed class WindowService
{
    private const int SaveDebounceMs = 400;

    private readonly Window _window;
    private readonly RpcClient _rpc;
    private readonly SemaphoreSlim _saveLock = new(1, 1);

    public bool IsQuitOnClose { get; set; } = true;

    public bool IsCloseToTray { get; set; }

    public bool IsWindowVisible => _visible;

    public event Action? WindowHidden;

    public event Action? WindowShown;

    public WindowService(Window window, RpcClient rpc)
    {
        _window = window;
        _rpc = rpc;
    }

    private bool _closingSubscribed;
    private bool _shownOnce;
    private bool _applying;
    private bool _visible;
    private CancellationTokenSource? _saveCts;
    private int _lastSavedWidth;
    private int _lastSavedHeight;
    private bool _lastSavedMaximized;
    private int _pendingWidth;
    private int _pendingHeight;
    private bool _pendingIsMaximized;
    private bool _hasPending;

    public async Task InitializeAsync()
    {
        IsQuitOnClose = await ReadBoolAsync("QuitOnClose", true);
        IsCloseToTray = await ReadBoolAsync("closeToTray", false);

        var width = 0;
        var height = 0;
        var isMaximized = false;
        var sizeEl = await ReadJsonAsync("windowSize");
        if (sizeEl is { ValueKind: JsonValueKind.Object } el &&
            el.TryGetProperty("width", out var wEl) && wEl.ValueKind == JsonValueKind.Number &&
            el.TryGetProperty("height", out var hEl) && hEl.ValueKind == JsonValueKind.Number)
        {
            width = wEl.GetInt32();
            height = hEl.GetInt32();
            if (el.TryGetProperty("isMaximized", out var mEl) && mEl is { ValueKind: JsonValueKind.True or JsonValueKind.False })
            {
                isMaximized = mEl.GetBoolean();
            }
        }

        var dispatcher = _window.DispatcherQueue;
        dispatcher.TryEnqueue(() =>
        {
            if (!_closingSubscribed)
            {
                _closingSubscribed = true;
                _window.AppWindow.Closing += OnClosing;
                _window.AppWindow.Changed += OnAppWindowChanged;
            }
            if (!_shownOnce)
            {
                _shownOnce = true;
                Activate();
            }
            if (width > 0 && height > 0)
            {
                ApplySavedBounds(width, height, isMaximized);
            }
            AppLog.Write("window", $"initialized, QuitOnClose={IsQuitOnClose}, closeToTray={IsCloseToTray}, restored size {width}x{height}, isMaximized={isMaximized}");
        });
    }

    private async Task<JsonElement?> ReadJsonAsync(string key)
    {
        try
        {
            return await _rpc.CallAsync<JsonElement?>("getUserData", key);
        }
        catch (Exception ex)
        {
            AppLog.Write("window", $"failed to read {key}: {ex.Message}");
            return null;
        }
    }

    private async Task<bool> ReadBoolAsync(string key, bool fallback)
    {
        try
        {
            var value = await _rpc.CallAsync<JsonElement?>("getUserData", key);
            if (value is JsonElement { ValueKind: JsonValueKind.True or JsonValueKind.False } el)
            {
                return el.GetBoolean();
            }
            if (value is JsonElement s && s.ValueKind == JsonValueKind.String)
            {
                return s.GetString() == "true";
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("window", $"failed to read {key}: {ex.Message}");
        }
        return fallback;
    }

    private void ApplySavedBounds(int width, int height, bool isMaximized)
    {
        _applying = true;
        try
        {
            if (isMaximized)
            {
                if (_window.AppWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter presenter)
                {
                    presenter.Maximize();
                }
                AppLog.Write("window", $"restored maximized (saved size {width}x{height})");
                return;
            }
            var display = DisplayArea.GetFromWindowId(_window.AppWindow.Id, DisplayAreaFallback.Nearest);
            var work = display.WorkArea;
            var w = Math.Min(width, work.Width);
            var h = Math.Min(height, work.Height);
            var x = work.X + (work.Width - w) / 2;
            var y = work.Y + (work.Height - h) / 2;
            _window.AppWindow.MoveAndResize(new RectInt32(x, y, w, h));
            AppLog.Write("window", $"restored size {w}x{h}, centered at {x},{y}");
        }
        finally
        {
            _applying = false;
        }
    }

    private void UpdateVisibility()
    {
        var isMinimized = _window.AppWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter { State: Microsoft.UI.Windowing.OverlappedPresenterState.Minimized };
        var visible = _window.AppWindow.IsVisible && !isMinimized;
        if (visible == _visible)
        {
            return;
        }
        _visible = visible;
        AppLog.Write("window", $"visibility: {(visible ? "shown" : "hidden")}");
        if (visible)
        {
            WindowShown?.Invoke();
        }
        else
        {
            WindowHidden?.Invoke();
        }
    }

    private void OnAppWindowChanged(AppWindow sender, AppWindowChangedEventArgs args)
    {
        UpdateVisibility();
        if (args.DidSizeChange || args.DidPresenterChange || args.DidPositionChange)
        {
            OnSizeChanged();
        }
    }

    private void OnSizeChanged()
    {
        if (_applying)
        {
            return;
        }
        if (_window.AppWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter { State: Microsoft.UI.Windowing.OverlappedPresenterState.Minimized })
        {
            return;
        }
        var isMaximized = _window.AppWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter { State: Microsoft.UI.Windowing.OverlappedPresenterState.Maximized };
        var size = _window.AppWindow.Size;
        _pendingWidth = size.Width;
        _pendingHeight = size.Height;
        _pendingIsMaximized = isMaximized;
        _hasPending = true;
        _saveCts?.Cancel();
        _saveCts?.Dispose();
        _saveCts = new CancellationTokenSource();
        _ = SaveSizeAsync(size.Width, size.Height, isMaximized, debounce: true, _saveCts.Token);
    }

    private async Task SaveSizeAsync(int width, int height, bool isMaximized, bool debounce, CancellationToken token)
    {
        if (debounce)
        {
            try
            {
                await Task.Delay(SaveDebounceMs, token);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
        try
        {
            await _saveLock.WaitAsync(token);
            try
            {
                if (token.IsCancellationRequested)
                {
                    return;
                }
                await _rpc.CallAsync<object?>("setUserData", new { key = "windowSize", data = new { width, height, isMaximized } }, timeoutMs: 5000);
                _lastSavedWidth = width;
                _lastSavedHeight = height;
                _lastSavedMaximized = isMaximized;
                if (_hasPending && _pendingWidth == width && _pendingHeight == height && _pendingIsMaximized == isMaximized)
                {
                    _hasPending = false;
                }
                AppLog.Write("window", $"saved window size {width}x{height}, isMaximized={isMaximized}");
            }
            finally
            {
                _saveLock.Release();
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            AppLog.Write("window", $"failed to save window size: {ex.Message}");
        }
    }

    private void FlushPendingSize()
    {
        _saveCts?.Cancel();
        _saveCts?.Dispose();
        _saveCts = null;
        if (_applying || !_hasPending)
        {
            return;
        }
        var width = _pendingWidth;
        var height = _pendingHeight;
        var isMaximized = _pendingIsMaximized;
        if (width == _lastSavedWidth && height == _lastSavedHeight && isMaximized == _lastSavedMaximized)
        {
            _hasPending = false;
            return;
        }
        _hasPending = false;
        _ = SaveSizeAsync(width, height, isMaximized, debounce: false, CancellationToken.None);
    }

    private void OnClosing(AppWindow sender, AppWindowClosingEventArgs args)
    {
        args.Cancel = true;
        FlushPendingSize();
        if (IsCloseToTray)
        {
            AppLog.Write("window", "close-to-tray, hiding window");
            sender.Hide();
        }
        else if (IsQuitOnClose)
        {
            AppLog.Write("window", "quit-on-close, shutting down");
            App.ShutdownApp();
        }
        else
        {
            AppLog.Write("window", "close hides window (quit-on-close off)");
            sender.Hide();
        }
    }

    public void Minimize()
    {
        if (_window.AppWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter presenter)
        {
            presenter.Minimize();
        }
    }

    public void Activate()
    {
        _window.AppWindow.Show();
        _window.Activate();
    }

    public async Task ToggleQuitOnCloseAsync()
    {
        await _rpc.CallAsync<object?>("toggleQuitOnClose");
        IsQuitOnClose = !IsQuitOnClose;
        AppLog.Write("window", $"QuitOnClose={IsQuitOnClose}");
    }
}