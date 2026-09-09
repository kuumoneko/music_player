using System.Collections.Concurrent;
using System.Threading;
using Avalonia.Media.Imaging;

namespace KuumoApp.Services;

public static class ImageCache
{
    private const int MaxEntries = 20;

    private static ConcurrentDictionary<string, Bitmap> Cache = new();
    private static readonly ConcurrentQueue<string> AccessOrder = new();

    public static bool TryGet(string url, out Bitmap? bitmap)
    {
        if (Cache.TryGetValue(url, out var cached))
        {
            bitmap = cached;
            return true;
        }
        bitmap = null;
        return false;
    }

    public static void Set(string url, Bitmap bitmap)
    {
        if (Cache.TryAdd(url, bitmap))
        {
            AccessOrder.Enqueue(url);
            EvictIfNeeded();
        }
    }

    public static void Clear()
    {
        var old = Interlocked.Exchange(ref Cache, new ConcurrentDictionary<string, Bitmap>());
        while (AccessOrder.TryDequeue(out _)) { }
        foreach (var kv in old)
        {
            kv.Value.Dispose();
        }
    }

    private static void EvictIfNeeded()
    {
        while (Cache.Count > MaxEntries && AccessOrder.TryDequeue(out var oldest))
        {
            Cache.TryRemove(oldest, out _);
        }
    }
}
