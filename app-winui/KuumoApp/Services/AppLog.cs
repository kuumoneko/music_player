using System.Collections.Concurrent;
using System.Diagnostics;

namespace KuumoApp.Services;

public static class AppLog
{
    private const int MaxQueued = 500;

    private static readonly ConcurrentQueue<(string Type, string Source, string Message)> Pending = new();
    private static volatile Func<string, string, string, Task>? _sink;
    private static int _flushing;

    static AppLog()
    {
        _ = Task.Run(FlushLoop);
    }

    public static void SetSink(Func<string, string, string, Task> sink)
    {
        _sink = sink;
        _ = FlushAsync();
    }

    public static void Write(string source, string message)
    {
        var line = $"{DateTime.Now:HH:mm:ss.fff} [{source}] {message}";
        Pending.Enqueue(("info", source, line));
        while (Pending.Count > MaxQueued && Pending.TryDequeue(out _))
        {
        }
        Debug.WriteLine(line);
        _ = FlushAsync();
    }

    private static async Task FlushLoop()
    {
        while (true)
        {
            await Task.Delay(250);
            await FlushAsync();
        }
    }

    private static async Task FlushAsync()
    {
        if (Interlocked.Exchange(ref _flushing, 1) == 1)
        {
            return;
        }
        try
        {
            var sink = _sink;
            if (sink is null)
            {
                return;
            }
            while (Pending.TryDequeue(out var entry))
            {
                try
                {
                    await sink(entry.Type, entry.Source, entry.Message);
                }
                catch
                {
                    // Backend unreachable — drop rather than retry forever.
                }
            }
        }
        finally
        {
            Interlocked.Exchange(ref _flushing, 0);
        }
    }
}
