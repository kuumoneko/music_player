using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.VisualTree;

namespace KuumoApp.Controls;

public sealed class HorizontalStrip : Panel
{
    private const double MinCardWidth = 110;
    private const double CardSpacing = 12;
    private const double ScrollBarHeight = 0;

    private readonly StackPanel _panel = new() { Orientation = Orientation.Horizontal, Spacing = CardSpacing };
    private readonly ScrollBar _bar = new()
    {
        Orientation = Orientation.Horizontal,
        Minimum = 0,
        SmallChange = 100,
        LargeChange = 300,
        Height = ScrollBarHeight,
        IsVisible = false,
    };

    private double _offset;
    private double _maxOffset;
    private bool _pointerDown;
    private bool _dragging;
    private Point _lastPoint;
    private double _dragDistance;

    public bool IsDragging => _dragging;

    public HorizontalStrip()
    {
        _panel.RenderTransform = new TranslateTransform();
        Background = Brushes.Transparent;
        Children.Add(_panel);
        Children.Add(_bar);

        _bar.ValueChanged += (_, e) => SetOffset(e.NewValue);
        PointerWheelChanged += OnPointerWheelChanged;
        PointerPressed += OnPointerPressed;
        PointerMoved += OnPointerMoved;
        PointerReleased += OnPointerReleased;
        PointerCaptureLost += (_, _) => ResetDrag();
    }

    public void AddCard(Control card) => _panel.Children.Add(card);

    protected override Size MeasureOverride(Size availableSize)
    {
        var childCount = _panel.Children.Count;
        if (childCount == 0)
        {
            return new Size(availableSize.Width, 0);
        }

        var availableWidth = availableSize.Width;
        if (double.IsInfinity(availableWidth))
        {
            availableWidth = 1200;
        }

        var cardCount = Math.Max(1, (int)Math.Floor((availableWidth + CardSpacing) / (MinCardWidth + CardSpacing)));
        cardCount = Math.Min(cardCount, childCount);

        var cardWidth = (availableWidth - CardSpacing * (cardCount - 1)) / cardCount;

        foreach (var child in _panel.Children)
        {
            if (child is Control control)
            {
                control.Width = cardWidth;
                control.Measure(new Size(cardWidth, availableSize.Height));
            }
        }

        var needsScroll = childCount > cardCount;
        _bar.IsVisible = needsScroll;

        var totalContentWidth = cardCount * cardWidth + (cardCount - 1) * CardSpacing;
        _maxOffset = needsScroll
            ? Math.Max(0, (childCount * (cardWidth + CardSpacing)) - availableWidth)
            : 0;
        _bar.Maximum = _maxOffset;
        _bar.LargeChange = availableWidth;

        if (!needsScroll)
        {
            SetOffset(0);
        }

        var stripHeight = ScrollBarHeight > 0 ? availableSize.Height : cardWidth + 48;
        return new Size(availableSize.Width, stripHeight);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        var childCount = _panel.Children.Count;
        if (childCount == 0)
        {
            return finalSize;
        }

        var availableWidth = finalSize.Width;
        var cardCount = Math.Max(1, (int)Math.Floor((availableWidth + CardSpacing) / (MinCardWidth + CardSpacing)));
        cardCount = Math.Min(cardCount, childCount);
        var cardWidth = (availableWidth - CardSpacing * (cardCount - 1)) / cardCount;

        foreach (var child in _panel.Children)
        {
            if (child is Control control)
            {
                control.Width = cardWidth;
            }
        }

        _panel.Height = finalSize.Height - ScrollBarHeight - 48;
        _panel.Arrange(new Rect(0, 24, childCount * (cardWidth + CardSpacing), finalSize.Height - ScrollBarHeight - 48));

        return finalSize;
    }

    private void SetOffset(double value)
    {
        var v = Math.Clamp(value, 0, _maxOffset);
        if (Math.Abs(v - _offset) < 0.01)
        {
            return;
        }
        _offset = v;
        if (_panel.RenderTransform is TranslateTransform t) t.X = -v;
        _bar.Value = v;
    }

    private void OnPointerWheelChanged(object? sender, PointerWheelEventArgs e)
    {
        var delta = e.Delta;
        var isHorizontal = Math.Abs(delta.X) > Math.Abs(delta.Y);
        var isShift = e.KeyModifiers.HasFlag(KeyModifiers.Shift);

        if (isHorizontal || isShift)
        {
            SetOffset(_offset - delta.X * 40 - delta.Y * 40);
        }
        else
        {
            var sv = this.FindAncestorOfType<ScrollViewer>();
            if (sv is not null)
            {
                sv.Offset = new Vector(sv.Offset.X, sv.Offset.Y - delta.Y * 40);
            }
        }
        e.Handled = true;
    }

    private void OnPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        _pointerDown = true;
        _lastPoint = e.GetPosition(this);
        _dragDistance = 0;
        _dragging = false;
    }

    private void OnPointerMoved(object? sender, PointerEventArgs e)
    {
        if (!_pointerDown)
        {
            return;
        }
        var pos = e.GetPosition(this);
        var dx = _lastPoint.X - pos.X;
        if (dx == 0)
        {
            return;
        }
        _lastPoint = pos;
        if (!_dragging)
        {
            _dragDistance += Math.Abs(dx);
            if (_dragDistance < 6)
            {
                return;
            }
            _dragging = true;
            e.Pointer.Capture(this);
        }
        SetOffset(_offset + dx);
        e.Handled = true;
    }

    private void OnPointerReleased(object? sender, PointerReleasedEventArgs e)
    {
        if (_dragging)
        {
            e.Pointer.Capture(null);
            _dragging = false;
            e.Handled = true;
        }
        _pointerDown = false;
    }

    private void ResetDrag()
    {
        _pointerDown = false;
        _dragging = false;
    }
}