using System.Drawing;
using CommunityToolkit.Mvvm.Input;
using H.NotifyIcon;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace KuumoApp.Services;

public sealed class TrayService : IDisposable
{
    private readonly Window _window;
    private readonly WindowService _windowService;
    private readonly TaskbarIcon _tray;
    private Icon? _icon;
    private bool _disposed;

    public TrayService(Window window, WindowService windowService, TaskbarIcon tray)
    {
        _window = window;
        _windowService = windowService;
        _tray = tray;
        _tray.ToolTipText = "Kuumo App";
        _tray.ContextMenuMode = ContextMenuMode.SecondWindow;
        _tray.LeftClickCommand = new RelayCommand(ToggleWindow);
        _tray.ContextFlyout = BuildMenu();
        LoadIcon();
    }

    private void LoadIcon()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico");
            if (File.Exists(path))
            {
                _icon = new Icon(path);
                _tray.Icon = _icon;
                return;
            }
            AppLog.Write("tray", $"icon not found at {path}");
            _tray.Icon = SystemIcons.Application;
        }
        catch (Exception ex)
        {
            AppLog.Write("tray", $"failed to load icon: {ex.Message}");
            _tray.Icon = SystemIcons.Application;
        }
    }

    private MenuFlyout BuildMenu()
    {
        var flyout = new MenuFlyout();

        var showHide = new MenuFlyoutItem { Text = "Show / Hide window" };
        showHide.Click += (_, _) => ToggleWindow();

        var quit = new MenuFlyoutItem { Text = "Quit" };
        quit.Click += (_, _) => App.ShutdownApp();

        flyout.Items.Add(showHide);
        flyout.Items.Add(quit);
        return flyout;
    }

    private void ToggleWindow()
    {
        if (_windowService.IsWindowVisible)
        {
            _windowService.IsWindowVisible = false;
            _window.AppWindow.Hide();
        }
        else
        {
            _windowService.Activate();
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;
        _icon?.Dispose();
        _icon = null;
        _tray.Dispose();
    }
}
