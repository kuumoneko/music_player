using System.Linq;
using KuumoApp.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Shapes;
using Windows.Foundation;

namespace KuumoApp.Controls;

public sealed partial class EqGraphControl : UserControl
{
    private static readonly int[] Freqs = { 31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 };
    private const double MinGain = -20;
    private const double MaxGain = 20;
    private const double HandleRadius = 7;
    private const double HitRadius = 18;
    private const double ThrottleMs = 80;

    private readonly double[] _gains = new double[Freqs.Length];
    private readonly Ellipse[] _handles = new Ellipse[Freqs.Length];
    private int _dragIndex = -1;
    private DateTime _lastEmit = DateTime.MinValue;

    public event Action<EqualizerBandDto[]>? BandsChanged;

    public EqGraphControl()
    {
        InitializeComponent();
        Loaded += (_, _) => Redraw();
        SizeChanged += (_, _) => Redraw();
    }

    public void SetBands(EqualizerBandDto[]? bands)
    {
        for (var i = 0; i < Freqs.Length; i++)
        {
            _gains[i] = 0;
        }
        if (bands is not null)
        {
            foreach (var b in bands)
            {
                var i = Array.IndexOf(Freqs, b.Freq);
                if (i >= 0)
                {
                    _gains[i] = Math.Clamp(b.Gain, MinGain, MaxGain);
                }
            }
        }
        Redraw();
    }

    private void Redraw()
    {
        Root.Children.Clear();
        var w = Math.Max(Root.ActualWidth, 320);
        var h = Math.Max(Root.ActualHeight, 160);
        const double left = 24;
        const double right = 24;
        const double top = 12;
        const double labelH = 18;
        const double bottom = 12;
        var midY = top + (h - top - labelH - bottom) / 2;
        var amp = Math.Max(midY - top - 8, 20);

        var gridBrush = Brush("TextFillColorTertiaryBrush", new SolidColorBrush(Microsoft.UI.Colors.Gray));
        var centerBrush = Brush("TextFillColorSecondaryBrush", new SolidColorBrush(Microsoft.UI.Colors.Gray));
        var accent = Brush("AppAccentBrush", Brush("AccentFillColorDefaultBrush", new SolidColorBrush(Microsoft.UI.Colors.DodgerBlue)));

        for (var g = MinGain; g <= MaxGain; g += 5)
        {
            var y = midY - (g / MaxGain) * amp;
            var isCenter = g == 0;
            Root.Children.Add(new Line
            {
                X1 = 0,
                Y1 = y,
                X2 = w,
                Y2 = y,
                Stroke = isCenter ? centerBrush : gridBrush,
                StrokeThickness = isCenter ? 1.5 : 1,
                Opacity = isCenter ? 1 : 0.6,
            });
        }

        var span = w - left - right;
        var xs = new double[Freqs.Length];
        for (var i = 0; i < Freqs.Length; i++)
        {
            xs[i] = left + i * span / (Freqs.Length - 1);
        }

        var poly = new Polyline { Stroke = accent, StrokeThickness = 2 };
        for (var i = 0; i < Freqs.Length; i++)
        {
            poly.Points.Add(new Point(xs[i], midY - (_gains[i] / MaxGain) * amp));
        }
        Root.Children.Add(poly);

        for (var i = 0; i < Freqs.Length; i++)
        {
            var x = xs[i];
            var y = midY - (_gains[i] / MaxGain) * amp;
            var handle = new Ellipse
            {
                Width = HandleRadius * 2,
                Height = HandleRadius * 2,
                Fill = accent,
                Stroke = new SolidColorBrush(Microsoft.UI.Colors.White),
                StrokeThickness = 1.5,
                Tag = i,
            };
            Canvas.SetLeft(handle, x - HandleRadius);
            Canvas.SetTop(handle, y - HandleRadius);
            Root.Children.Add(handle);
            _handles[i] = handle;

            var label = new TextBlock
            {
                Text = FormatFreq(Freqs[i]),
                FontSize = 10,
                Foreground = gridBrush,
            };
            Canvas.SetLeft(label, x - 12);
            Canvas.SetTop(label, h - labelH);
            Root.Children.Add(label);
        }
    }

    private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        var idx = HitTest(e.GetCurrentPoint(Root).Position);
        if (idx >= 0)
        {
            _dragIndex = idx;
            Root.CapturePointer(e.Pointer);
            e.Handled = true;
        }
    }

    private void OnPointerMoved(object sender, PointerRoutedEventArgs e)
    {
        if (_dragIndex < 0)
        {
            return;
        }
        SetGainFromY(_dragIndex, e.GetCurrentPoint(Root).Position.Y);
        Redraw();
        EmitThrottled();
    }

    private void OnPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        if (_dragIndex < 0)
        {
            return;
        }
        _dragIndex = -1;
        Root.ReleasePointerCaptures();
        Emit();
    }

    private void OnDoubleTapped(object sender, DoubleTappedRoutedEventArgs e)
    {
        var idx = HitTest(e.GetPosition(Root));
        if (idx >= 0)
        {
            _gains[idx] = 0;
            Redraw();
            Emit();
        }
    }

    private void SetGainFromY(int index, double y)
    {
        var h = Math.Max(Root.ActualHeight, 160);
        const double top = 12;
        const double labelH = 18;
        const double bottom = 12;
        var midY = top + (h - top - labelH - bottom) / 2;
        var amp = Math.Max(midY - top - 8, 20);
        var gain = ((midY - y) / amp) * MaxGain;
        _gains[index] = Math.Round(Math.Clamp(gain, MinGain, MaxGain));
    }

    private int HitTest(Point pt)
    {
        var best = -1;
        var bestDist = double.MaxValue;
        for (var i = 0; i < _handles.Length; i++)
        {
            if (_handles[i] is null)
            {
                continue;
            }
            var cx = Canvas.GetLeft(_handles[i]) + HandleRadius;
            var cy = Canvas.GetTop(_handles[i]) + HandleRadius;
            var d = Math.Sqrt((pt.X - cx) * (pt.X - cx) + (pt.Y - cy) * (pt.Y - cy));
            if (d < HitRadius && d < bestDist)
            {
                bestDist = d;
                best = i;
            }
        }
        return best;
    }

    private void EmitThrottled()
    {
        if ((DateTime.UtcNow - _lastEmit).TotalMilliseconds < ThrottleMs)
        {
            return;
        }
        _lastEmit = DateTime.UtcNow;
        Emit();
    }

    private void Emit()
    {
        var bands = Freqs.Select((f, i) => new EqualizerBandDto(f, (int)_gains[i])).ToArray();
        BandsChanged?.Invoke(bands);
    }

    private static string FormatFreq(int freq) => freq < 1000 ? freq.ToString() : $"{freq / 1000}k";

    private static Brush Brush(string key, Brush fallback) =>
        Application.Current.Resources.TryGetValue(key, out var value) && value is Brush brush
            ? brush
            : fallback;
}
