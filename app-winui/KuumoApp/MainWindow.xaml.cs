using System.Text.Json;
using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

namespace KuumoApp;

public sealed partial class MainWindow : Window
{
    private readonly WindowService _windowService;
    private readonly SmtcService _smtc;
    private readonly TrayService _tray;
    private readonly UiMemoryManager _memory;
    private readonly DispatcherQueueTimer _showFallbackTimer;
    private bool _smtcInitialized;
    private int _lastTimeMs;
    private int _lastDurationMs;
    private SmtcUpdateDto? _lastSmtc;

    public MainWindow()
    {
        InitializeComponent();
        Title = "Kuumo App";

        var iconPath = Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico");
        if (File.Exists(iconPath))
        {
            AppWindow.SetIcon(iconPath);
        }

        _windowService = new WindowService(this, App.Services.Rpc);
        App.Services.Window = _windowService;
        _smtc = new SmtcService(this);
        _tray = new TrayService(this, _windowService, TrayIcon);
        _memory = new UiMemoryManager(this, App.Services.Rpc);

        _windowService.WindowHidden += () =>
        {
            _memory.OnWindowHidden();
        };
        _windowService.WindowShown += () =>
        {
            _showFallbackTimer.Stop();
            _memory.OnWindowShown();
            if (_lastSmtc is not null)
            {
                _smtc.Update(_lastSmtc);
            }
        };

        _showFallbackTimer = DispatcherQueue.CreateTimer();
        _showFallbackTimer.Interval = TimeSpan.FromSeconds(12);
        _showFallbackTimer.IsRepeating = false;
        _showFallbackTimer.Tick += (_, _) =>
        {
            if (!_windowService.IsWindowVisible)
            {
                AppLog.Write("window", "backend not ready in time, showing window at default bounds");
                _windowService.Activate();
            }
        };
        _showFallbackTimer.Start();

        App.Services.Events.OpenApp += () => _windowService.Activate();
        App.Services.Events.AppExit += App.ShutdownApp;
        App.Services.SingleInstanceDetected += () => DispatcherQueue.TryEnqueue(App.ShutdownApp);
        App.Services.Events.MessageReceived += data => AppLog.Write("app", $"showMessage: {data.Title} - {data.Message}");
        App.Services.Events.SmtcUpdated += data =>
        {
            _lastSmtc = data;
            _smtc.Update(data);
        };
        App.Services.Events.TimeUpdated += data =>
        {
            _lastTimeMs = (int)(data.Time * 1000);
            _smtc.UpdatePosition(_lastTimeMs, _lastDurationMs);
        };
        App.Services.Events.PlayerStateChanged += data =>
        {
            _lastDurationMs = (int)data.Duration;
            _smtc.UpdatePosition(_lastTimeMs, (int)data.Duration);
        };

        Activated += (_, _) =>
        {
            if (!_smtcInitialized)
            {
                _smtcInitialized = true;
                _smtc.Initialize();
            }
        };
        Closed += (_, _) =>
        {
            _smtc.Dispose();
            _tray.Dispose();
        };

        Shell.SetStatus("starting backend...");
        App.Services.Bun.LogLine += line => AppLog.Write("main", line);
        App.Services.Bun.EndpointReady += url => AppLog.Write("main", $"backend endpoint: {url}");
        App.Services.Rpc.Connected += OnRpcConnected;
    }

    private async void OnRpcConnected()
    {
        AppLog.Write("main", "rpc connected");
        try
        {
            var isLocal = await App.Services.Rpc.CallAsync<bool>("getIsLocal");
            var playing = await App.Services.Api.GetPlayingDataAsync();
            AppLog.Write("main", $"getIsLocal={isLocal}, playing={JsonSerializer.Serialize(playing)}");
            if (playing is not null)
            {
                _lastTimeMs = (int)(playing.Current.Time * 1000);
                _lastDurationMs = (int)playing.Current.Duration;
                DispatcherQueue.TryEnqueue(() => _smtc.UpdatePosition((int)(playing.Current.Time * 1000), (int)playing.Current.Duration));
            }
            var current = await App.Services.Api.GetCurrentPlayingAsync();
            if (current is not null)
            {
                DispatcherQueue.TryEnqueue(() => _smtc.Update(new SmtcUpdateDto(current.Title, current.Artist, current.Thumbnail, false, playing?.IsPlaying ?? false)));
            }
            await _windowService.InitializeAsync();
            DispatcherQueue.TryEnqueue(() => Shell.SetStatus($"connected | isLocal={isLocal}"));
        }
        catch (Exception ex)
        {
            AppLog.Write("main", $"startup failed: {ex.ToString()}");
        }
    }
}
