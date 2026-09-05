using KuumoApp.Controls;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace KuumoApp.Services;

public sealed class UiMemoryManager
{
    private const int TrimDelayMs = 4000;
    private const int NotifyTimeoutMs = 5000;

    private readonly Window _window;
    private readonly RpcClient _rpc;
    private readonly List<(Image Image, string Url)> _captured = [];
    private int _transitionGen;
    private bool _isBackground;

    public UiMemoryManager(Window window, RpcClient rpc)
    {
        _window = window;
        _rpc = rpc;
    }

    public bool IsBackground => _isBackground;

    public void OnWindowHidden()
    {
        _isBackground = true;
        _transitionGen++;
        _captured.Clear();
        var gen = _transitionGen;

        if (_window.Content is not null)
        {
            WalkAndUnload(_window.Content, _captured);
        }
        ImageCache.Clear();
        AppLog.Write("mem", $"hidden: unloaded {_captured.Count} image(s), image cache cleared");
        _ = NotifyBackendAsync(false);
        _ = ScheduleTrimAsync(gen);
    }

    public void OnWindowShown()
    {
        _isBackground = false;
        _transitionGen++;
        var captured = _captured.ToArray();
        _captured.Clear();
        foreach (var (image, url) in captured)
        {
            _ = ImageAttach.LoadAsync(image, url);
        }
        AppLog.Write("mem", $"shown: rehydrating {captured.Length} image(s)");
        _ = NotifyBackendAsync(true);
    }

    private async Task ScheduleTrimAsync(int gen)
    {
        try
        {
            await Task.Delay(TrimDelayMs);
        }
        catch (Exception)
        {
            return;
        }
        if (gen != _transitionGen || !_isBackground)
        {
            return;
        }
        var before = MemoryTrimmer.WorkingSetBytes;
        MemoryTrimmer.TrimWorkingSet();
        var after = MemoryTrimmer.WorkingSetBytes;
        AppLog.Write("mem", $"trimmed working set: {(before / 1024.0 / 1024.0):F1} MB -> {(after / 1024.0 / 1024.0):F1} MB");
    }

    private async Task NotifyBackendAsync(bool visible)
    {
        try
        {
            await _rpc.CallAsync<object?>("setUiVisibility", visible, timeoutMs: NotifyTimeoutMs);
        }
        catch (Exception ex)
        {
            AppLog.Write("mem", $"setUiVisibility({visible}) failed: {ex.Message}");
        }
    }

    private static void WalkAndUnload(DependencyObject root, List<(Image Image, string Url)> captured)
    {
        if (root is Image img)
        {
            var url = ImageAttach.GetSourceUrl(img);
            if (!string.IsNullOrEmpty(url) && img.Source is not null)
            {
                captured.Add((img, url));
                img.Source = null;
                img.Tag = null;
            }
        }
        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            WalkAndUnload(VisualTreeHelper.GetChild(root, i), captured);
        }
    }
}