using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace KuumoApp.Services;

public sealed class RpcClient : IDisposable
{
    private const int BaseReconnectDelayMs = 1000;
    private const int MaxReconnectDelayMs = 30_000;
    private const int MaxBackoffShift = 5;
    private const int JitterMaxMs = 500;

    public static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private static readonly JsonSerializerOptions SendJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly ConcurrentDictionary<long, TaskCompletionSource<JsonElement>> _pending = new();
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private readonly SemaphoreSlim _connectLock = new(1, 1);
    private readonly CancellationTokenSource _cts = new();
    private readonly object _reconnectGate = new();
    private ClientWebSocket? _ws;
    private long _nextId;
    private volatile bool _disposed;
    private int _reconnectionAttempts;
    private int _isReconnecting;
    private Timer? _reconnectTimer;
    private Uri? _lastEndpoint; // Track the last connected endpoint
    private bool _hasConnectedOnce;

    public event Action<string, JsonElement>? EventReceived;
    public event Action? Connected;
    public event Action? Disconnected;
    public event Action? Reconnected;

    public bool IsConnected => _ws?.State == WebSocketState.Open;

    public async Task ConnectAsync(Uri endpoint)
    {
        if (IsConnected)
        {
            return;
        }

        try
        {
            await _connectLock.WaitAsync();
        }
        catch (ObjectDisposedException)
        {
            return;
        }

        try
        {
            if (_disposed || _cts.IsCancellationRequested)
            {
                return;
            }
            if (IsConnected)
            {
                return;
            }
            DisposeWs();

            var ws = new ClientWebSocket();
            ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
            try
            {
                // Remember the endpoint before dialing so a failed retry still knows where to go.
                _lastEndpoint = endpoint;
                await ws.ConnectAsync(endpoint, _cts.Token);
            }
            catch
            {
                ws.Dispose();
                throw;
            }

            _ws = ws;
            AppLog.Write("rpc", $"connected to {endpoint}");
            _reconnectionAttempts = 0; // Reset reconnection attempts on successful connection
            _lastEndpoint = endpoint; // Store the endpoint for potential reconnects

            bool wasReconnect = _hasConnectedOnce;
            _hasConnectedOnce = true;
            RaiseStateEvent(Connected, nameof(Connected));
            if (wasReconnect)
            {
                // Re-hydration hook: subscribers re-sync state and resubscribe after a drop.
                RaiseStateEvent(Reconnected, nameof(Reconnected));
            }

            _ = ReceiveLoopAsync(ws, _cts.Token);
        }
        finally
        {
            _connectLock.Release();
        }
    }

    /// <summary>
    /// Schedules the next reconnect attempt with capped exponential backoff (1s, 2s, 4s ... 30s) plus jitter.
    /// A single timer instance is reused via <see cref="Timer.Change(int, int)"/> so overlapping
    /// disconnect paths can never spawn parallel retry loops.
    /// </summary>
    private void ScheduleReconnect()
    {
        lock (_reconnectGate)
        {
            if (_disposed || _cts.IsCancellationRequested || _lastEndpoint == null)
            {
                return;
            }

            _reconnectTimer ??= new Timer(
                static state => ((RpcClient)state!).OnReconnectTick(),
                this,
                Timeout.Infinite,
                Timeout.Infinite);

            // "Key" is incremented before scheduling, so subtract one for the first ~1000ms delay.
            int attempt = Math.Max(0, Volatile.Read(ref _reconnectionAttempts) - 1);
            int delayMs = Math.Min(BaseReconnectDelayMs << Math.Min(attempt, MaxBackoffShift), MaxReconnectDelayMs);
            delayMs += Random.Shared.Next(0, JitterMaxMs);

            try
            {
                _reconnectTimer.Change(delayMs, Timeout.Infinite);
            }
            catch (ObjectDisposedException)
            {
                // Dispose raced with scheduling; the client is shutting down.
            }
        }
    }

    private async void OnReconnectTick()
    {
        // Only one retry loop may run at a time; overlapping disconnects bail out here.
        if (Interlocked.CompareExchange(ref _isReconnecting, 1, 0) != 0)
        {
            return;
        }

        try
        {
            var endpoint = _lastEndpoint;
            if (_disposed || _cts.IsCancellationRequested || endpoint == null || IsConnected)
            {
                return;
            }

            await ConnectAsync(endpoint);
        }
        catch (Exception ex)
        {
            AppLog.Write("rpc", $"reconnect attempt failed: {ex.Message}");
            if (!_disposed && !_cts.IsCancellationRequested)
            {
                Interlocked.Increment(ref _reconnectionAttempts);
                ScheduleReconnect();
            }
        }
        finally
        {
            Interlocked.Exchange(ref _isReconnecting, 0);
        }
    }

    public Task<T> CallAsync<T>(string method, object? parameters = null, int timeoutMs = 60_000)
        => CallAsync(method, parameters, static (el, opts) => el.Deserialize<T>(opts)!, timeoutMs);

    public async Task<JsonElement?> CallAsync(string method, object? parameters = null, int timeoutMs = 60_000)
        => await CallAsync(method, parameters, static (el, _) => el, timeoutMs);

    private async Task<T> CallAsync<T>(string method, object? parameters, Func<JsonElement, JsonSerializerOptions, T> convert, int timeoutMs)
    {
        if (_disposed)
        {
            throw new ObjectDisposedException(nameof(RpcClient));
        }

        var id = Interlocked.Increment(ref _nextId);
        var tcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[id] = tcs;
        var payload = JsonSerializer.Serialize(new { id, method, @params = parameters }, SendJson);
        try
        {
            await SendAsync(payload);
            using var cts = new CancellationTokenSource(timeoutMs);
            var result = await tcs.Task.WaitAsync(cts.Token);
            return convert(result, Json);
        }
        catch (OperationCanceledException)
        {
            _pending.TryRemove(id, out _);
            throw new TimeoutException($"RPC call '{method}' timed out after {timeoutMs}ms");
        }
        catch
        {
            _pending.TryRemove(id, out _);
            throw;
        }
    }

    private async Task SendAsync(string payload)
    {
        var ws = _ws ?? throw new InvalidOperationException("RpcClient is not connected");
        var bytes = Encoding.UTF8.GetBytes(payload);
        if (!await _sendLock.WaitAsync(TimeSpan.FromSeconds(10)))
        {
            throw new TimeoutException("RPC send timed out acquiring the send lock");
        }
        try
        {
            using var sendCts = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token);
            sendCts.CancelAfter(TimeSpan.FromSeconds(10));
            await ws.SendAsync(bytes, WebSocketMessageType.Text, true, sendCts.Token);
        }
        finally
        {
            _sendLock.Release();
        }
    }

    private async Task ReceiveLoopAsync(ClientWebSocket ws, CancellationToken ct)
    {
        var buffer = new byte[64 * 1024];
        var sb = new StringBuilder();
        bool wasConnected = ws.State == WebSocketState.Open;

        try
        {
            while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                try
                {
                    var result = await ws.ReceiveAsync(buffer, ct);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }
                    sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                    if (result.EndOfMessage)
                    {
                        OnMessage(sb.ToString());
                        sb.Clear();
                    }
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    break; // Expected during shutdown
                }
                catch (Exception ex)
                {
                    AppLog.Write("rpc", $"receive loop ended: {ex.Message}");
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("rpc", $"receive loop ended: {ex.Message}");
        }
        finally
        {
            try
            {
                ws.Dispose();
            }
            catch
            {
                // Already faulted; nothing to clean up.
            }

            if (ReferenceEquals(_ws, ws))
            {
                _ws = null;

                // Fail in-flight callers immediately so none of them hang until their timeout.
                FailPending(new IOException("connection closed"));

                if (!_disposed)
                {
                    if (wasConnected)
                    {
                        RaiseStateEvent(Disconnected, nameof(Disconnected));
                    }

                    // Schedule automatic reconnect with exponential backoff.
                    Interlocked.Increment(ref _reconnectionAttempts);
                    ScheduleReconnect();
                }
            }
        }
    }

    private void OnMessage(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.TryGetProperty("event", out var ev) && root.TryGetProperty("data", out var data))
            {
                EventReceived?.Invoke(ev.GetString() ?? "", data.Clone());
            }
            else if (root.TryGetProperty("id", out var idEl))
            {
                var id = idEl.GetInt64();
                if (_pending.TryRemove(id, out var tcs))
                {
                    if (root.TryGetProperty("error", out var error))
                    {
                        var message = error.TryGetProperty("message", out var m) ? m.GetString() : "RPC error";
                        AppLog.Write("rpc", $"RPC error response for id {id}: '{message}'");
                        tcs.TrySetException(new InvalidOperationException(message ?? "RPC error"));
                    }
                    else
                    {
                        tcs.TrySetResult(root.GetProperty("result").Clone());
                    }
                }
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("rpc", $"failed to parse message: {ex.Message}");
        }
    }

    private void FailPending(Exception exception)
    {
        while (!_pending.IsEmpty)
        {
            foreach (var kv in _pending)
            {
                if (_pending.TryRemove(kv.Key, out var tcs))
                {
                    tcs.TrySetException(exception);
                }
            }
        }
    }

    private static void RaiseStateEvent(Action? handler, string name)
    {
        if (handler == null)
        {
            return;
        }

        try
        {
            handler();
        }
        catch (Exception ex)
        {
            AppLog.Write("rpc", $"{name} handler threw: {ex.Message}");
        }
    }

    private void DisposeWs()
    {
        var ws = Interlocked.Exchange(ref _ws, null);
        try
        {
            ws?.Dispose();
        }
        catch
        {
            // Socket already faulted.
        }
    }

    public void Dispose()
    {
        lock (_reconnectGate)
        {
            if (_disposed)
            {
                return;
            }
            _disposed = true;

            // Cancel any pending reconnect attempt and release the timer exactly once.
            try
            {
                _reconnectTimer?.Change(Timeout.Infinite, Timeout.Infinite);
            }
            catch (ObjectDisposedException)
            {
                // Timer callback already disposed it.
            }
            _reconnectTimer?.Dispose();
            _reconnectTimer = null;
        }

        try
        {
            _cts.Cancel();
        }
        catch (ObjectDisposedException)
        {
            // Already torn down.
        }

        DisposeWs();
        FailPending(new ObjectDisposedException(nameof(RpcClient)));
        _cts.Dispose();
    }
}
