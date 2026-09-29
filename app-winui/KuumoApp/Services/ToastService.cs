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
    private static DispatcherTimer? _timer;

    public static void Initialize(Popup popup, Border border, TextBlock text)
    {
        _popup = popup;
        _border = border;
        _text = text;
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

    public static void ShowInfo(string message, int autoCloseMs = 3000)
        => Show(message, ToastSeverity.Info, autoCloseMs);

    private static void Show(string message, ToastSeverity severity, int autoCloseMs)
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
