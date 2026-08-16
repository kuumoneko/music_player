using System.Text.Json;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;

namespace KuumoApp.Services;

public sealed class WindowService
{
    private readonly Window _window;
    private readonly RpcClient _rpc;

    public bool IsQuitOnClose { get; set; } = true;

    public bool IsCloseToTray { get; set; }

    public bool IsWindowVisible { get; set; } = true;

    public event Action? WindowHidden;

    public event Action? WindowShown;

    public WindowService(Window window, RpcClient rpc)
    {
        _window = window;
        _rpc = rpc;
    }

    private bool _closingSubscribed;

    public async Task InitializeAsync()
    {
        IsQuitOnClose = await ReadBoolAsync("QuitOnClose", true);
        IsCloseToTray = await ReadBoolAsync("closeToTray", false);

        var dispatcher = _window.DispatcherQueue;
        dispatcher.TryEnqueue(() =>
        {
            if (!_closingSubscribed)
            {
                _closingSubscribed = true;
                _window.AppWindow.Closing += OnClosing;
                _window.AppWindow.Changed += (_, _) => UpdateVisibility();
            }
            AppLog.Write("window", $"initialized, QuitOnClose={IsQuitOnClose}, closeToTray={IsCloseToTray}");
        });
    }

    private void UpdateVisibility()
    {
        var isMinimized = _window.AppWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter { State: Microsoft.UI.Windowing.OverlappedPresenterState.Minimized };
        var visible = _window.AppWindow.IsVisible && !isMinimized;
        if (visible == IsWindowVisible)
        {
            return;
        }
        IsWindowVisible = visible;
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

    private void OnClosing(AppWindow sender, AppWindowClosingEventArgs args)
    {
        args.Cancel = true;
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
        IsWindowVisible = true;
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
