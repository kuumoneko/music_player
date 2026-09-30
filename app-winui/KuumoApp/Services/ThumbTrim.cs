using System;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Security.Cryptography;
using Windows.Storage.Streams;

namespace KuumoApp.Services;

public static class ThumbTrim
{
    private const byte BlackThreshold = 24;
    private const double MinContentRatio = 0.45;
    private const double MinRunRatio = 0.015;
    private const int MinSourceSide = 64;
    private const int MaxSourceSide = 4096;

    public static async Task<byte[]?> TrimAsync(byte[] source)
    {
        try
        {
            if (source.Length < 64)
            {
                return null;
            }
            using var inStream = new InMemoryRandomAccessStream();
            using (var writer = new DataWriter(inStream))
            {
                writer.WriteBytes(source);
                await writer.StoreAsync();
                writer.DetachStream();
            }
            inStream.Seek(0);
            var decoder = await BitmapDecoder.CreateAsync(inStream);
            var width = decoder.PixelWidth;
            var height = decoder.PixelHeight;
            if (width < MinSourceSide || height < MinSourceSide ||
                width > MaxSourceSide || height > MaxSourceSide)
            {
                return null;
            }
            var transform = new BitmapTransform
            {
                ScaledWidth = width,
                ScaledHeight = height,
                InterpolationMode = BitmapInterpolationMode.Linear,
            };
            var provider = await decoder.GetPixelDataAsync(
                BitmapPixelFormat.Bgra8,
                BitmapAlphaMode.Premultiplied,
                transform,
                ExifOrientationMode.IgnoreExifOrientation,
                ColorManagementMode.DoNotColorManage);
            var pixels = provider.DetachPixelData();
            var w = (int)width;
            var h = (int)height;
            if (pixels.Length < w * h * 4)
            {
                return null;
            }
            var content = DetectContentRect(pixels, w, h);
            if (content is not { } c)
            {
                return null;
            }

            var cropped = new byte[c.W * c.H * 4];
            var srcStride = w * 4;
            var dstStride = c.W * 4;
            for (var row = 0; row < c.H; row++)
            {
                System.Buffer.BlockCopy(
                    pixels, (c.Y + row) * srcStride + c.X * 4,
                    cropped, row * dstStride, dstStride);
            }
            var bitmap = new SoftwareBitmap(BitmapPixelFormat.Bgra8, c.W, c.H, BitmapAlphaMode.Premultiplied);
            bitmap.CopyFromBuffer(CryptographicBuffer.CreateFromByteArray(cropped));

            var isPng = source.Length > 8 && source[0] == 0x89 && source[1] == 0x50;
            using var outStream = new InMemoryRandomAccessStream();
            var encoder = await BitmapEncoder.CreateAsync(
                isPng ? BitmapEncoder.PngEncoderId : BitmapEncoder.JpegEncoderId, outStream);
            encoder.SetSoftwareBitmap(bitmap);
            await encoder.FlushAsync();
            bitmap.Dispose();
            outStream.Seek(0);
            var reader = new DataReader(outStream);
            await reader.LoadAsync((uint)outStream.Size);
            var trimmed = new byte[reader.UnconsumedBufferLength];
            reader.ReadBytes(trimmed);
            reader.DetachStream();
            if (trimmed.Length == 0)
            {
                return null;
            }
            AppLog.Write("thumb", $"trimmed {width}x{height} -> {c.W}x{c.H}");
            return trimmed;
        }
        catch (Exception ex)
        {
            AppLog.Write("thumb", $"trim skipped: {ex.Message}");
            return null;
        }
    }

    private static (int X, int Y, int W, int H)? DetectContentRect(byte[] pixels, int w, int h)
    {
        var stride = w * 4;
        var colBlack = new bool[w];
        var rowBlack = new bool[h];
        var colStep = Math.Max(1, h / 240);
        var rowStep = Math.Max(1, w / 240);
        for (var x = 0; x < w; x++)
        {
            byte max = 0;
            for (var y = 0; y < h && max <= BlackThreshold; y += colStep)
            {
                var i = y * stride + x * 4;
                var v = Math.Max(pixels[i], Math.Max(pixels[i + 1], pixels[i + 2]));
                if (v > max)
                {
                    max = v;
                }
            }
            colBlack[x] = max <= BlackThreshold;
        }
        for (var y = 0; y < h; y++)
        {
            byte max = 0;
            var row = y * stride;
            for (var x = 0; x < w && max <= BlackThreshold; x += rowStep)
            {
                var i = row + x * 4;
                var v = Math.Max(pixels[i], Math.Max(pixels[i + 1], pixels[i + 2]));
                if (v > max)
                {
                    max = v;
                }
            }
            rowBlack[y] = max <= BlackThreshold;
        }

        var minX = Math.Max(4, (int)Math.Ceiling(w * MinRunRatio));
        var minY = Math.Max(4, (int)Math.Ceiling(h * MinRunRatio));
        var left = 0;
        while (left < w && colBlack[left])
        {
            left++;
        }
        var right = w - 1;
        while (right >= 0 && colBlack[right])
        {
            right--;
        }
        var top = 0;
        while (top < h && rowBlack[top])
        {
            top++;
        }
        var bottom = h - 1;
        while (bottom >= 0 && rowBlack[bottom])
        {
            bottom--;
        }
        var trimX = left >= minX && w - 1 - right >= minX;
        var trimY = top >= minY && h - 1 - bottom >= minY;
        if (!trimX && !trimY)
        {
            return null;
        }

        var x0 = trimX ? left : 0;
        var x1 = trimX ? right + 1 : w;
        var y0 = trimY ? top : 0;
        var y1 = trimY ? bottom + 1 : h;
        if (x1 - x0 < w * MinContentRatio || y1 - y0 < h * MinContentRatio)
        {
            return null;
        }
        if (x0 == 0 && y0 == 0 && x1 == w && y1 == h)
        {
            return null;
        }
        return (x0, y0, x1 - x0, y1 - y0);
    }
}
