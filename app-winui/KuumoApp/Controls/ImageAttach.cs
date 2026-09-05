using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.Foundation;
using Windows.Storage.Streams;

namespace KuumoApp.Controls;

public static class ImageAttach
{
    private const int DefaultDecodeSize = 200;

    public static readonly DependencyProperty SourceUrlProperty = DependencyProperty.RegisterAttached(
        "SourceUrl", typeof(string), typeof(ImageAttach), new PropertyMetadata(null, OnSourceUrlChanged));

    public static void SetSourceUrl(Image image, string? value) => image.SetValue(SourceUrlProperty, value);
    public static string? GetSourceUrl(Image image) => (string?)image.GetValue(SourceUrlProperty);

    public static readonly DependencyProperty SquareCropProperty = DependencyProperty.RegisterAttached(
        "SquareCrop", typeof(bool), typeof(ImageAttach), new PropertyMetadata(false));

    public static void SetSquareCrop(Image image, bool value) => image.SetValue(SquareCropProperty, value);
    public static bool GetSquareCrop(Image image) => (bool)image.GetValue(SquareCropProperty);

    private static async void OnSourceUrlChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not Image image)
        {
            return;
        }
        await LoadAsync(image, e.NewValue as string);
    }

    public static async Task LoadAsync(Image image, string? url)
    {
        if (string.IsNullOrEmpty(url))
        {
            image.Source = null;
            return;
        }
        if (image.Tag as string == url)
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
                    if (GetSquareCrop(image))
                    {
                        ApplySquareCrop(image, cached);
                    }
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
            using var stream = new InMemoryRandomAccessStream();
            using (var writer = new DataWriter(stream))
            {
                writer.WriteBytes(bytes);
                await writer.StoreAsync();
                writer.DetachStream();
            }
            stream.Seek(0);
            var decodeWidth = !double.IsNaN(image.Width) && image.Width > 0
                ? (int)image.Width
                : (int)DefaultDecodeSize;
            var bitmap = new BitmapImage
            {
                DecodePixelWidth = decodeWidth,
            };
            await bitmap.SetSourceAsync(stream);
            if (image.Tag as string == url)
            {
                ImageCache.Set(url, bitmap);
                image.Source = bitmap;
                if (GetSquareCrop(image))
                {
                    ApplySquareCrop(image, bitmap);
                }
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("thumb", $"failed: {ex.Message}");
        }
    }

    private static void ApplySquareCrop(Image image, BitmapImage bitmap)
    {
        var side = !double.IsNaN(image.Width)
            ? image.Width
            : !double.IsNaN(image.Height)
                ? image.Height
                : 120;
        double w = bitmap.PixelWidth;
        double h = bitmap.PixelHeight;
        if (w <= 0 || h <= 0)
        {
            return;
        }
        if (w > h)
        {
            image.Width = side * w / h;
            image.Height = side;
        }
        else
        {
            image.Height = side * h / w;
            image.Width = side;
        }
        image.HorizontalAlignment = HorizontalAlignment.Center;
        image.VerticalAlignment = VerticalAlignment.Center;
        image.Clip = new RectangleGeometry
        {
            Rect = new Rect((image.Width - side) / 2, (image.Height - side) / 2, side, side),
        };
    }
}
