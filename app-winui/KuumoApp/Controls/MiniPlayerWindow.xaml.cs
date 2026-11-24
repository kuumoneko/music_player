using System;
using System.Runtime.InteropServices;
using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.Graphics;
using WinRT.Interop;

namespace KuumoApp.Controls;

public sealed partial class MiniPlayerWindow : Page
{
    private readonly Window _window;
    private readonly DispatcherQueue _dispatcherQueue;
    private readonly DispatcherQueueTimer _topmostTimer;
    private bool _isPlaying;
    private bool _disposed = false;
    private bool _isVisible = false;
    private double _positionSeconds;
    private double _durationSeconds;
    private bool _initialStateLoaded = false;

    private const int BaseWidth = 300;   // px @ 96 DPI
    private const int BaseHeight = 38;   // px @ 96 DPI
    private const int BasePadX = 8;      // px @ 96 DPI

    public MiniPlayerWindow()
    {
        InitializeComponent();
        _window = new Window();
        _window.Content = this;
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();

        _window.Title = "Kuumo App Mini Player";
        _window.ExtendsContentIntoTitleBar = true;
        _window.SetTitleBar(null); // No draggable title bar -> no caption buttons either

        // Borderless tool window, no minimize/maximize/close buttons on the mini player itself.
        if (_window.AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.IsResizable = false;
            presenter.IsMaximizable = false;
            presenter.IsMinimizable = false;
            presenter.SetBorderAndTitleBar(false, false);
            presenter.IsAlwaysOnTop = true;
        }

        // Keep it out of the taskbar / Alt+Tab, and strip every non-client frame style.
        var hwnd = WindowNative.GetWindowHandle(_window);
        StripNonClientFrame(hwnd);

        // DWM still paints a 1px frame around a borderless WinUI window; strip it.
        ApplyFramelessChrome(hwnd);

        _window.Activated += OnWindowActivated;
        _window.Closed += OnWindowClosed;

        App.Services.Events.CurrentTrackChanged += OnCurrentTrackChanged;
        App.Services.Events.PlayerStateChanged += OnPlayerStateChanged;
        App.Services.Events.TimeUpdated += OnTimeUpdated;
        App.Services.Rpc.Connected += OnRpcConnected;

        // The taskbar re-asserts its own topmost band when clicked or on shell restarts,
        // so keep promoting the mini player above it while visible.
        _topmostTimer = _dispatcherQueue.CreateTimer();
        _topmostTimer.Interval = TimeSpan.FromSeconds(2);
        _topmostTimer.Tick += (_, _) => ReassertTopmost();

        // Intentionally NOT closed here: a closed Window has no HWND and AppWindow.Show() becomes a no-op.
        
        // Load initial state if RPC is already connected
        if (App.Services.Rpc.IsConnected)
        {
            _ = LoadInitialStateAsync();
        }
    }

    private void OnWindowActivated(object sender, WindowActivatedEventArgs args)
    {
        if (args.WindowActivationState != WindowActivationState.Deactivated)
        {
            ReassertTopmost();
        }
    }

    private void OnWindowClosed(object sender, WindowEventArgs args)
    {
        Dispose();
    }

    private async void OnRpcConnected()
    {
        try
        {
            await LoadInitialStateAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("miniplayer", $"Failed to load initial state on reconnect: {ex.Message}");
        }
    }

    private async Task LoadInitialStateAsync()
    {
        if (_disposed || _initialStateLoaded)
        {
            return;
        }

        try
        {
            var playingData = await App.Services.Api.GetPlayingDataAsync();
            if (playingData != null)
            {
                _isPlaying = playingData.IsPlaying;
                _durationSeconds = playingData.Current.Duration / 1000.0;
                _positionSeconds = playingData.Current.Time;

                _dispatcherQueue.TryEnqueue(() =>
                {
                    UpdatePlayPauseButton();
                    UpdateTimeText();
                });
            }

            var currentTrack = await App.Services.Api.GetCurrentPlayingAsync();
            if (currentTrack != null)
            {
                _dispatcherQueue.TryEnqueue(() =>
                {
                    TrackTitle.Text = string.IsNullOrEmpty(currentTrack.Title) ? "Nothing playing" : currentTrack.Title;
                    TrackArtist.Text = currentTrack.Artist ?? "";
                    _ = ImageAttach.LoadAsync(Thumb, currentTrack.Thumbnail);
                });
            }

            _initialStateLoaded = true;
        }
        catch (Exception ex)
        {
            AppLog.Write("miniplayer", $"Failed to load initial state: {ex.Message}");
        }
    }

    private void OnCurrentTrackChanged(CurrentTrackChangedDto data)
    {
        _dispatcherQueue.TryEnqueue(() =>
        {
            TrackTitle.Text = string.IsNullOrEmpty(data.Title) ? "Nothing playing" : data.Title;
            TrackArtist.Text = data.Artist ?? "";
            _ = ImageAttach.LoadAsync(Thumb, data.Thumbnail);
            
            // Reset position when track changes
            _positionSeconds = 0;
            UpdateTimeText();
            
            // Load the actual position for new track
            _ = LoadInitialStateAsync();
        });
    }

    private void OnPlayerStateChanged(PlayerStateChangeDto data)
    {
        _dispatcherQueue.TryEnqueue(() =>
        {
            _isPlaying = data.IsPlaying;
            if (data.Duration > 0)
            {
                // playerStateChange.duration is milliseconds; timeUpdate.time is seconds.
                _durationSeconds = data.Duration / 1000.0;
            }
            UpdatePlayPauseButton();
            UpdateTimeText();
        });
    }

    private void OnTimeUpdated(TimeUpdateDto data)
    {
        _dispatcherQueue.TryEnqueue(() =>
        {
            // Handle NaN and Infinity values
            if (double.IsNaN(data.Time) || double.IsInfinity(data.Time))
            {
                _positionSeconds = 0;
            }
            else if (data.Time < 0)
            {
                _positionSeconds = 0;
            }
            else
            {
                _positionSeconds = data.Time;
            }
            UpdateTimeText();
        });
    }

    private void UpdateTimeText()
    {
        CurrentTime.Text = $"{FormatTime((int)(_positionSeconds * 1000))} / {FormatTime((int)(_durationSeconds * 1000))}";
    }

    private void UpdatePlayPauseButton()
    {
        PlayPauseButton.Content = _isPlaying ? "\xE769" : "\xE768";
    }

    private static string FormatTime(int ms)
    {
        var total = Math.Max(0, ms / 1000);
        return $"{total / 60}:{total % 60:00}";
    }

    public void Show()
    {
        if (_disposed)
        {
            return;
        }

        // Show first, then position + promote: SetWindowPos needs a live, visible HWND.
        _window.AppWindow.Show(false);
        PositionOverTaskbar();
        _isVisible = true;
        _topmostTimer.Start();
        
        // Load initial state if not already loaded
        if (!_initialStateLoaded)
        {
            _ = LoadInitialStateAsync();
        }
        
        // Update UI visibility for backend
        UpdateUiVisibility();
    }

    public void Hide()
    {
        if (_disposed)
        {
            return;
        }

        _topmostTimer.Stop();
        _window.AppWindow.Hide();
        _isVisible = false;
        
        // Update UI visibility for backend
        UpdateUiVisibility();
    }
    
    private void UpdateUiVisibility()
    {
        // Compute if any window is visible (main or mini player)
        var anyVisible = IsVisible || (App.Services.Window?.IsWindowVisible ?? false);
        
        // Fire-and-forget call to update backend visibility
        _ = App.Services.Api.SetUiVisibilityAsync(anyVisible).ContinueWith(task =>
        {
            if (task.Exception != null)
            {
                AppLog.Write("miniplayer", $"Failed to update UI visibility: {task.Exception.Message}");
            }
        });
    }

    public void Toggle()
    {
        if (IsVisible)
        {
            Hide();
        }
        else
        {
            Show();
        }
    }

    public bool IsVisible => _isVisible;

    /// <summary>
    /// Pins the mini player inside the Windows 11 taskbar band, at its left edge.
    /// All values are physical pixels:
    ///   scale   = GetDpiForWindow(hwnd) / 96
    ///   width   = 300 * scale
    ///   height  = 38  * scale
    ///   x       = taskbar.Left + 8 * scale
    ///   y       = taskbar.Top  + (taskbar.Height - height) / 2
    /// If Shell_TrayWnd cannot be found, the taskbar band is approximated as the bottom
    /// 48*scale strip of DisplayArea.OuterBounds (the full screen, WorkArea excluded).
    /// </summary>
    private void PositionOverTaskbar()
    {
        try
        {
            var hwnd = WindowNative.GetWindowHandle(_window);

            var dpi = GetDpiForWindow(hwnd);
            var scale = dpi > 0 ? dpi / 96.0 : 1.0;

            int width = (int)Math.Round(BaseWidth * scale);
            int height = (int)Math.Round(BaseHeight * scale);
            int padX = (int)Math.Round(BasePadX * scale);

            int bandLeft, bandTop, bandWidth, bandHeight;

            var taskbar = FindWindow("Shell_TrayWnd", null);
            if (taskbar != IntPtr.Zero && GetWindowRect(taskbar, out var tb) && tb.Right > tb.Left && tb.Bottom > tb.Top)
            {
                bandLeft = tb.Left;
                bandTop = tb.Top;
                bandWidth = tb.Right - tb.Left;
                bandHeight = tb.Bottom - tb.Top;
            }
            else
            {
                DisplayArea area;
                try
                {
                    area = DisplayArea.GetFromWindowId(_window.AppWindow.Id, DisplayAreaFallback.Primary);
                }
                catch
                {
                    area = DisplayArea.Primary;
                }

                var outer = area.OuterBounds; // full screen bounds, unlike WorkArea
                bandHeight = (int)Math.Round(48 * scale);
                bandLeft = outer.X;
                bandTop = outer.Y + outer.Height - bandHeight;
                bandWidth = outer.Width;
            }

            var x = bandLeft + padX;
            var y = bandTop + Math.Max(0, (bandHeight - height) / 2);

            _window.AppWindow.MoveAndResize(new RectInt32(x, y, width, height));

            // Promote above Shell_TrayWnd's topmost band and force the frame to paint.
            SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW);

            // Re-apply after showing: some shell transitions reset the DWM frame color.
            ApplyFramelessChrome(hwnd);

            AppLog.Write("miniplayer", $"visible at ({x},{y}) size {width}x{height} dpi {dpi} taskbarBand ({bandLeft},{bandTop},{bandWidth},{bandHeight})");
        }
        catch (Exception ex)
        {
            AppLog.Write("miniplayer", $"Failed to position on taskbar: {ex.Message}");
        }
    }

    /// <summary>
    /// Removes every non-client frame style (caption, thick/border/dlg frame, and the 3D
    /// edge extended styles) then forces a frame recalculation, so the HWND has no
    /// client-area offset and no native border is painted.
    /// </summary>
    private static void StripNonClientFrame(IntPtr hwnd)
    {
        const int GWL_STYLE = -16;

        long style = (long)(nuint)GetWindowLongPtr(hwnd, GWL_STYLE);
        style &= ~((long)(WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME));
        SetWindowLongPtr(hwnd, GWL_STYLE, (IntPtr)style);

        long exStyle = (long)(nuint)GetWindowLongPtr(hwnd, GWL_EXSTYLE);
        exStyle &= ~((long)(WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE));
        exStyle |= WS_EX_TOOLWINDOW; // stay out of taskbar / Alt+Tab
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, (IntPtr)exStyle);

        SetWindowPos(hwnd, IntPtr.Zero, 0, 0, 0, 0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    }

    private static void ApplyFramelessChrome(IntPtr hwnd)
    {
        // DWMWA_BORDER_COLOR = DWMWA_COLOR_NONE removes the 1px white/accent frame.
        int noBorder = unchecked((int)DWMWA_COLOR_NONE);
        DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, ref noBorder, sizeof(int));

        // Small rounding: square/rounded arcs would re-introduce a visible frame edge.
        int corner = DWMWCP_ROUNDSMALL;
        DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref corner, sizeof(int));
    }

    private void ReassertTopmost()
    {
        if (!_isVisible || _disposed)
        {
            return;
        }

        try
        {
            var hwnd = WindowNative.GetWindowHandle(_window);
            SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
            ApplyFramelessChrome(hwnd);
        }
        catch (Exception ex)
        {
            AppLog.Write("miniplayer", $"Topmost reassert failed: {ex.Message}");
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;

        _topmostTimer.Stop();
        _topmostTimer.Tick -= OnTopmostTimerTick;
        _window.Activated -= OnWindowActivated;
        _window.Closed -= OnWindowClosed;

        App.Services.Events.CurrentTrackChanged -= OnCurrentTrackChanged;
        App.Services.Events.PlayerStateChanged -= OnPlayerStateChanged;
        App.Services.Events.TimeUpdated -= OnTimeUpdated;
        App.Services.Rpc.Connected -= OnRpcConnected;

        try
        {
            // Try to hide and close the window
            _window.AppWindow.Hide();
            _window.Close();
        }
        catch (Exception ex)
        {
            AppLog.Write("miniplayer", $"Failed to dispose window: {ex.Message}");
        }
    }

    private void OnTopmostTimerTick(object? sender, object e)
    {
        ReassertTopmost();
    }

    private async void OnPrevClick(object sender, RoutedEventArgs e)
    {
        await App.Services.Api.PreviousAsync();
    }

    private async void OnPlayPauseClick(object sender, RoutedEventArgs e)
    {
        await App.Services.Api.TogglePlayPauseAsync();
    }

    private async void OnNextClick(object sender, RoutedEventArgs e)
    {
        await App.Services.Api.NextAsync();
    }

    private void OnThumbTapped(object sender, TappedRoutedEventArgs e)
    {
        App.MainWindow?.Activate();
    }

    // Win32 interop
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int WS_EX_WINDOWEDGE = 0x00000100;
    private const int WS_EX_CLIENTEDGE = 0x00000200;
    private const int WS_EX_STATICEDGE = 0x00020000;

    private const int WS_CAPTION = 0x00C00000;
    private const int WS_THICKFRAME = 0x00040000;
    private const int WS_BORDER = 0x00800000;
    private const int WS_DLGFRAME = 0x00400000;

    private static readonly IntPtr HWND_TOPMOST = new(-1);
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_FRAMECHANGED = 0x0020;
    private const uint SWP_SHOWWINDOW = 0x0040;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hWnd);

    // DWM attributes (Windows 11 22000+)
    private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
    private const int DWMWA_BORDER_COLOR = 34;
    private const uint DWMWA_COLOR_NONE = 0xFFFFFFFE;
    private const int DWMWCP_ROUNDSMALL = 3;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);
}
