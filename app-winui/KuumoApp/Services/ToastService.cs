using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Media;

namespace KuumoApp.Services;

public static class ToastService
{
    private static Popup? _popup;
    private static Border? _border;
    private static TextBlock? _text;
    private static Button? _action;
    private static DispatcherTimer? _timer;
    private static Action? _pendingAction;

    public static void Initialize(Popup popup, Border border, TextBlock text, Button? action = null)
    {
        _popup = popup;
        _border = border;
        _text = text;
        _action = action;
        if (_action is not null)
        {
            _action.Visibility = Visibility.Collapsed;
        }
        _timer = new DispatcherTimer();
        _timer.Tick += (_, _) =>
        {
            _timer.Stop();
            if (_popup is not null) _popup.IsOpen = false;
        };
    }

    public static void ShowError(string message, int autoCloseMs = 4000)
        => Show(message, ToastSeverity.Error, autoCloseMs);

    public static void ShowWarning(string message, int autoCloseMs = 3500)
        => Show(message, ToastSeverity.Warning, autoCloseMs);

    public static void ShowInfo(string message, int autoCloseMs = 3000, string? actionLabel = null, Action? action = null)
        => Show(message, ToastSeverity.Info, autoCloseMs, actionLabel, action);

    /// <summary>Runs the action button of the currently visible toast, if any.</summary>
    public static void InvokeAction()
    {
        var action = _pendingAction;
        _pendingAction = null;
        _timer?.Stop();
        if (_popup is not null)
        {
            _popup.IsOpen = false;
        }
        action?.Invoke();
    }

    private static void Show(string message, ToastSeverity severity, int autoCloseMs, string? actionLabel = null, Action? action = null)
    {
        if (_popup is null || _border is null || _text is null) return;
        _timer?.Stop();

        _border.Background = severity switch
        {
            ToastSeverity.Error => new SolidColorBrush(ColorHelper.FromArgb(255, 44, 26, 26)),
            ToastSeverity.Warning => new SolidColorBrush(ColorHelper.FromArgb(255, 60, 48, 16)),
            _ => new SolidColorBrush(ColorHelper.FromArgb(255, 20, 30, 48)),
        };

        _text.Text = message;
        _text.Foreground = new SolidColorBrush(Colors.White);

        var hasAction = actionLabel is not null && action is not null && _action is not null;
        _pendingAction = hasAction ? action : null;
        if (_action is not null)
        {
            _action.Visibility = hasAction ? Visibility.Visible : Visibility.Collapsed;
            if (hasAction)
            {
                _action.Content = actionLabel;
            }
        }

        if (_popup.XamlRoot is { } root)
        {
            _popup.HorizontalOffset = root.Size.Width - 530;
        }
        _popup.VerticalOffset = 16;
        _popup.IsOpen = true;

        if (autoCloseMs > 0 && _timer is not null)
        {
            _timer.Interval = TimeSpan.FromMilliseconds(autoCloseMs);
            _timer.Start();
        }
    }

    private enum ToastSeverity { Error, Warning, Info }
}
