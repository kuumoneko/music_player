using Avalonia.Controls;
using Avalonia.Media.Imaging;
using Avalonia.VisualTree;
using KuumoApp.Controls;
using KuumoApp.Views;

namespace KuumoApp.Services;

public sealed class UiMemoryManager
{
    private const int TrimDelayMs = 4000;
    private const int NotifyTimeoutMs = 5000;

    private readonly Window _window;
    private readonly RpcClient _rpc;
    private readonly List<(Image Image, string Url)> _captured = [];
    private object? _savedContent;
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

        if (_window.Content is not null && _window.Content is Avalonia.Visual visual)
        {
            WalkAndUnload(visual, _captured);
        }
        ImageCache.Clear();
        _savedContent = _window.Content;
        _window.Content = null;
        ShellPage.ClearInstance();
        AppLog.Suppress(true);
        StopRendering();
        AppLog.Write("mem", $"hidden: unloaded {_captured.Count} image(s), content detached, rendering stopped");
        AppLog.Suppress(false);
        GC.Collect(2, GCCollectionMode.Forced, true);
        GC.WaitForPendingFinalizers();
        GC.Collect(2, GCCollectionMode.Forced, true);
        _ = NotifyBackendAsync(false);
        _ = ScheduleTrimAsync(gen);
    }

    public void OnWindowShown()
    {
        _isBackground = false;
        _transitionGen++;
        AppLog.Suppress(false);
        if (_savedContent is null)
        {
            StartRendering();
            _ = NotifyBackendAsync(true);
            return;
        }
        var captured = _captured.ToArray();
        _captured.Clear();
        _window.Content = _savedContent;
        if (_savedContent is ShellPage shell) ShellPage.SetInstance(shell);
        _savedContent = null;
        ShellPage.Instance?.RestoreNavContent();
        ShellPage.Instance?.RestoreContent();
        StartRendering();
        foreach (var (image, url) in captured)
        {
            _ = ImageHelper.LoadAsync(image, url);
        }
        AppLog.Write("mem", $"shown: rehydrating {captured.Length} image(s), rendering started");
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

    private void StopRendering()
    {
        if (_window is MainWindow mainWindow)
        {
            mainWindow.PauseRendering();
            AppLog.Write("mem", "renderer paused");
        }
    }

    private void StartRendering()
    {
        if (_window is MainWindow mainWindow)
        {
            mainWindow.ResumeRendering();
            AppLog.Write("mem", "renderer resumed");
        }
    }

    private static void WalkAndUnload(Avalonia.Visual root, List<(Image Image, string Url)> captured)
    {
        if (root is Image img)
        {
            var url = ImageHelper.GetSourceUrl(img);
            if (!string.IsNullOrEmpty(url) && img.Source is not null)
            {
                captured.Add((img, url));
                if (img.Source is Bitmap oldBmp)
                {
                    oldBmp.Dispose();
                }
                img.Source = null;
                img.Tag = null;
            }
        }
        foreach (var child in root.GetVisualChildren())
        {
            WalkAndUnload(child, captured);
        }
    }
}