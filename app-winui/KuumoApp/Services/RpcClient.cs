using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace KuumoApp.Services;

public sealed class RpcClient : IDisposable
{
    public static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private static readonly JsonSerializerOptions SendJson = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private readonly ConcurrentDictionary<long, TaskCompletionSource<JsonElement>> _pending = new();
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private readonly SemaphoreSlim _connectLock = new(1, 1);
    private readonly CancellationTokenSource _cts = new();
    private ClientWebSocket? _ws;
    private long _nextId;
    private bool _disposed;

    public event Action<string, JsonElement>? EventReceived;
    public event Action? Connected;
    public event Action? Disconnected;

    public bool IsConnected => _ws?.State == WebSocketState.Open;

    public async Task ConnectAsync(Uri endpoint)
    {
        if (IsConnected)
        {
            return;
        }
        await _connectLock.WaitAsync();
        try
        {
            if (IsConnected)
            {
                return;
            }
            DisposeWs();
            var ws = new ClientWebSocket();
            ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
            await ws.ConnectAsync(endpoint, _cts.Token);
            _ws = ws;
            AppLog.Write("rpc", $"connected to {endpoint}");
            Connected?.Invoke();
            _ = ReceiveLoopAsync(ws, _cts.Token);
        }
        finally
        {
            _connectLock.Release();
        }
    }

    public Task<T> CallAsync<T>(string method, object? parameters = null, int timeoutMs = 60_000)
        => CallAsync(method, parameters, static (el, opts) => el.Deserialize<T>(opts)!, timeoutMs);

    public async Task<JsonElement?> CallAsync(string method, object? parameters = null, int timeoutMs = 60_000)
        => await CallAsync(method, parameters, static (el, _) => el, timeoutMs);

    private async Task<T> CallAsync<T>(string method, object? parameters, Func<JsonElement, JsonSerializerOptions, T> convert, int timeoutMs)
    {
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
        try
        {
            while (ws.State == WebSocketState.Open)
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
        }
        catch (Exception ex)
        {
            AppLog.Write("rpc", $"receive loop ended: {ex.Message}");
        }
        finally
        {
            ws.Dispose();
            FailPending(new IOException("connection closed"));
            if (ReferenceEquals(_ws, ws))
            {
                _ws = null;
                if (!_disposed)
                {
                    Disconnected?.Invoke();
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
                        tcs.SetException(new InvalidOperationException(message ?? "RPC error"));
                    }
                    else
                    {
                        tcs.SetResult(root.GetProperty("result").Clone());
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

    private void DisposeWs()
    {
        _ws?.Dispose();
        _ws = null;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;
        _cts.Cancel();
        DisposeWs();
        FailPending(new ObjectDisposedException(nameof(RpcClient)));
        _sendLock.Dispose();
        _connectLock.Dispose();
        _cts.Dispose();
    }
}
