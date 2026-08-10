using System.Text.Json;
using Microsoft.UI.Dispatching;

namespace KuumoApp.Services;

public sealed class AppServices
{
    private readonly SemaphoreSlim _reconnectLock = new(1, 1);
    private Uri? _endpoint;
    private bool _shuttingDown;

    public BunHostService Bun { get; } = new();
    public RpcClient Rpc { get; } = new();
    public RpcApi Api { get; }
    public AppEvents Events { get; }
    public ThemeService Theme { get; }
    public WindowService? Window { get; set; }

    public event Action? SingleInstanceDetected;

    public AppServices()
    {
        Api = new RpcApi(Rpc);
        Events = new AppEvents(DispatcherQueue.GetForCurrentThread());
        Theme = new ThemeService(Events, Rpc, DispatcherQueue.GetForCurrentThread());
    }

    public void Start()
    {
        Bun.LogLine += line => AppLog.Write("app", line);
        Bun.EndpointReady += OnEndpointReady;
        Bun.SingleInstanceDetected += () => SingleInstanceDetected?.Invoke();
        Rpc.EventReceived += Events.OnEvent;
        Rpc.Disconnected += OnRpcDisconnected;
        Theme.Start();
        Bun.Start();
    }

    private async void OnEndpointReady(string url)
    {
        AppLog.Write("app", $"endpoint: {url}");
        _endpoint = new Uri(url);
        await ConnectWithRetryAsync();
    }

    private async void OnRpcDisconnected()
    {
        AppLog.Write("app", "rpc disconnected, scheduling reconnect");
        await ConnectWithRetryAsync(delayMs: 2000);
    }

    private async Task ConnectWithRetryAsync(int delayMs = 0, int attempts = 5)
    {
        if (_shuttingDown)
        {
            return;
        }
        await _reconnectLock.WaitAsync();
        try
        {
            for (var i = 0; i < attempts; i++)
            {
                if (_shuttingDown)
                {
                    return;
                }
                if (Rpc.IsConnected)
                {
                    return;
                }
                if (_endpoint is null)
                {
                    return;
                }
                try
                {
                    await Rpc.ConnectAsync(_endpoint);
                    return;
                }
                catch (Exception ex)
                {
                    AppLog.Write("app", $"connect attempt {i + 1} failed: {ex.Message}");
                    if (i < attempts - 1)
                    {
                        await Task.Delay(delayMs > 0 ? delayMs : 2000);
                    }
                }
            }
        }
        finally
        {
            _reconnectLock.Release();
        }
    }

    public void Shutdown()
    {
        _shuttingDown = true;
        Bun.Stop();
        Rpc.Dispose();
    }
}
