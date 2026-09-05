using System.IO;
using Avalonia.Controls;
using Avalonia.Media.Imaging;
using Avalonia.Platform.Storage;
using KuumoApp.Services;
using SkiaSharp;

namespace KuumoApp.Controls;

public static class ImageHelper
{
    private const int DefaultDecodeSize = 160;
    private const string SourceUrlTagKey = "SourceUrl";

    public static void SetSourceUrl(Image image, string? value)
    {
        image.Tag = value;
        _ = LoadAsync(image, value);
    }

    public static string? GetSourceUrl(Image image) => image.Tag as string;

    public static async Task LoadAsync(Image image, string? url)
    {
        if (string.IsNullOrEmpty(url))
        {
            image.Source = null;
            return;
        }
        if (image.Tag as string == url && image.Source is not null)
        {
            return;
        }
        image.Tag = url;
        try
        {
            if (ImageCache.TryGet(url, out var cached) && cached is not null)
            {
                if (image.Tag as string == url)
                {
                    image.Source = cached;
                }
                return;
            }

            var dataUri = url.StartsWith("data:image", StringComparison.Ordinal)
                ? url
                : await App.Services.Api.GetImageDataUriAsync(url) ?? "";
            if (string.IsNullOrEmpty(dataUri))
            {
                image.Source = null;
                return;
            }
            var comma = dataUri.IndexOf(',');
            var bytes = Convert.FromBase64String(dataUri[(comma + 1)..]);
            var targetWidth = DefaultDecodeSize;
            var bitmap = DecodeResized(bytes, targetWidth);
            if (bitmap is null)
            {
                image.Source = null;
                return;
            }
            if (image.Tag as string == url)
            {
                if (image.Source is Bitmap oldBitmap)
                {
                    oldBitmap.Dispose();
                }
                ImageCache.Set(url, bitmap);
                image.Source = bitmap;
            }
            else
            {
                bitmap.Dispose();
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("thumb", $"failed: {ex.Message}");
        }
    }

    private static Bitmap? DecodeResized(byte[] jpegBytes, int targetWidth)
    {
        try
        {
            var scale = (float)targetWidth / jpegBytes.Length;
            using var skBitmap = SKBitmap.Decode(jpegBytes);
            if (skBitmap is null)
            {
                return null;
            }
            scale = (float)targetWidth / skBitmap.Width;
            if (scale >= 1.0f)
            {
                using var ms1 = new MemoryStream(jpegBytes);
                return new Bitmap(ms1);
            }
            var targetHeight = (int)(skBitmap.Height * scale);
            using var resized = skBitmap.Resize(new SKImageInfo(targetWidth, targetHeight), SKFilterQuality.Medium);
            if (resized is null)
            {
                using var ms2 = new MemoryStream(jpegBytes);
                return new Bitmap(ms2);
            }
            using var image = resized.Encode(SKEncodedImageFormat.Jpeg, 85);
            using var stream = new MemoryStream(image.AsSpan().ToArray());
            return new Bitmap(stream);
        }
        catch
        {
            using var ms = new MemoryStream(jpegBytes);
            return new Bitmap(ms);
        }
    }
}