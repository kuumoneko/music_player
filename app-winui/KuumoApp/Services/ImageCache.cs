using System.Collections.Concurrent;
using Microsoft.UI.Xaml.Media.Imaging;

namespace KuumoApp.Services;

public static class ImageCache
{
    private const int MaxEntries = 100;

    private static readonly ConcurrentDictionary<string, BitmapImage> Cache = new();
    private static readonly ConcurrentQueue<string> AccessOrder = new();

    public static bool TryGet(string url, out BitmapImage? bitmap)
    {
        if (Cache.TryGetValue(url, out var cached))
        {
            Promote(url);
            bitmap = cached;
            return true;
        }
        bitmap = null;
        return false;
    }

    public static void Set(string url, BitmapImage bitmap)
    {
        Cache[url] = bitmap;
        Promote(url);
        EvictIfNeeded();
    }

    public static void Clear()
    {
        Cache.Clear();
        while (AccessOrder.TryDequeue(out _)) { }
    }

    private static void Promote(string url)
    {
        AccessOrder.Enqueue(url);
    }

    private static void EvictIfNeeded()
    {
        while (Cache.Count > MaxEntries && AccessOrder.TryDequeue(out var oldest))
        {
            Cache.TryRemove(oldest, out _);
        }
    }
}
