using System;
using System.Threading;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;
using Windows.UI;

namespace KuumoApp.Services;

public static class AccentColorUtils
{
    public static (byte R, byte G, byte B) HexToRgb(string hex)
    {
        if (hex.Length >= 7 && hex.StartsWith("#", StringComparison.Ordinal) &&
            byte.TryParse(hex.Substring(1, 2), System.Globalization.NumberStyles.HexNumber, null, out var r) &&
            byte.TryParse(hex.Substring(3, 2), System.Globalization.NumberStyles.HexNumber, null, out var g) &&
            byte.TryParse(hex.Substring(5, 2), System.Globalization.NumberStyles.HexNumber, null, out var b))
        {
            return (r, g, b);
        }
        return (0, 0, 0);
    }

    public static Color HexToColor(string hex)
    {
        var (r, g, b) = HexToRgb(hex);
        return Color.FromArgb(255, r, g, b);
    }

    public static string RgbToHex(double r, double g, double b)
    {
        return $"#{ClampInt(r):x2}{ClampInt(g):x2}{ClampInt(b):x2}";
    }

    private static int ClampInt(double value)
    {
        return (int)Math.Round(Math.Max(0, Math.Min(255, value)));
    }

    public static (double H, double S, double L) RgbToHsl(byte r, byte g, byte b)
    {
        var rn = r / 255.0;
        var gn = g / 255.0;
        var bn = b / 255.0;
        var mx = Math.Max(rn, Math.Max(gn, bn));
        var mn = Math.Min(rn, Math.Min(gn, bn));
        var l = (mx + mn) / 2;
        if (Math.Abs(mx - mn) < 1e-9)
        {
            return (0, 0, l);
        }
        var d = mx - mn;
        var s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        double h;
        if (Math.Abs(mx - rn) < 1e-9)
        {
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        }
        else if (Math.Abs(mx - gn) < 1e-9)
        {
            h = ((bn - rn) / d + 2) / 6;
        }
        else
        {
            h = ((rn - gn) / d + 4) / 6;
        }
        return (h, s, l);
    }

    public static double Luminance(byte r, byte g, byte b)
    {
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }

    private static double SrgbToLinear(double c)
    {
        return c <= 0.03928 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
    }

    public static double RelativeLuminance(byte r, byte g, byte b)
    {
        return 0.2126 * SrgbToLinear(r / 255.0) +
               0.7152 * SrgbToLinear(g / 255.0) +
               0.0722 * SrgbToLinear(b / 255.0);
    }

    public static double GetContrastRatio(byte r1, byte g1, byte b1, byte r2, byte g2, byte b2)
    {
        var l1 = RelativeLuminance(r1, g1, b1);
        var l2 = RelativeLuminance(r2, g2, b2);
        return (Math.Max(l1, l2) + 0.05) / (Math.Min(l1, l2) + 0.05);
    }

    public static string EnsureContrast(string hex, string bgHex, double minRatio = 4.5)
    {
        var (r, g, b) = HexToRgb(hex);
        var (bgR, bgG, bgB) = HexToRgb(bgHex);

        var cr = GetContrastRatio(r, g, b, bgR, bgG, bgB);
        if (cr >= minRatio)
        {
            return hex;
        }

        var isDarkBg = RelativeLuminance(bgR, bgG, bgB) < 0.5;

        var factor = 1.0;
        for (var i = 0; i < 500; i++)
        {
            factor = isDarkBg ? factor * 1.02 : factor / 1.02;
            var nr = Clamp(isDarkBg ? r * factor : r / factor);
            var ng = Clamp(isDarkBg ? g * factor : g / factor);
            var nb = Clamp(isDarkBg ? b * factor : b / factor);
            if (isDarkBg && nr >= 255 && ng >= 255 && nb >= 255)
            {
                break;
            }
            if (!isDarkBg && nr <= 0 && ng <= 0 && nb <= 0)
            {
                break;
            }
            cr = GetContrastRatio(nr, ng, nb, bgR, bgG, bgB);
            if (cr >= minRatio)
            {
                return RgbToHex(nr, ng, nb);
            }
        }

        return isDarkBg ? "#ffffff" : "#000000";
    }

    public static string Darken(string hex, double amount)
    {
        var (r, g, b) = HexToRgb(hex);
        var factor = 1 - amount;
        return RgbToHex(r * factor, g * factor, b * factor);
    }

    public static string Lighten(string hex, double amount)
    {
        var (r, g, b) = HexToRgb(hex);
        var factor = 1 + amount;
        return RgbToHex(r * factor, g * factor, b * factor);
    }

    private static byte Clamp(double value)
    {
        return (byte)Math.Max(0, Math.Min(255, Math.Round(value)));
    }

    public static async Task<string?> ExtractDominantColorAsync(string dataUri, CancellationToken ct = default)
    {
        try
        {
            var comma = dataUri.IndexOf(',');
            var base64 = comma >= 0 ? dataUri[(comma + 1)..] : dataUri;
            var bytes = Convert.FromBase64String(base64);

            using var stream = new InMemoryRandomAccessStream();
            using (var writer = new DataWriter(stream))
            {
                writer.WriteBytes(bytes);
                await writer.StoreAsync();
                writer.DetachStream();
            }
            stream.Seek(0);

            var decoder = await BitmapDecoder.CreateAsync(stream);
            var transform = new BitmapTransform
            {
                ScaledWidth = 16,
                ScaledHeight = 16,
                InterpolationMode = BitmapInterpolationMode.Fant,
            };
            var provider = await decoder.GetPixelDataAsync(
                BitmapPixelFormat.Bgra8,
                BitmapAlphaMode.Ignore,
                transform,
                ExifOrientationMode.IgnoreExifOrientation,
                ColorManagementMode.DoNotColorManage);
            var pixels = provider.DetachPixelData();

            double sumR = 0, sumG = 0, sumB = 0, totalW = 0;
            for (var i = 0; i + 3 < pixels.Length; i += 4)
            {
                var pr = pixels[i + 2];
                var pg = pixels[i + 1];
                var pb = pixels[i];
                var (_, s, l) = RgbToHsl(pr, pg, pb);
                var score = s * (1 - Math.Abs(l - 0.5) * 1.6);
                var w = Math.Max(0.05, score);
                totalW += w;
                sumR += pr * w;
                sumG += pg * w;
                sumB += pb * w;
            }

            if (totalW <= 0)
            {
                return null;
            }
            return RgbToHex(sumR / totalW, sumG / totalW, sumB / totalW);
        }
        catch (Exception ex)
        {
            AppLog.Write("theme", $"extract failed: {ex.Message}");
            return null;
        }
    }
}
