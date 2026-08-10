using Microsoft.UI.Input;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Windows.Foundation;
using Windows.System;
using Windows.UI.Core;

namespace KuumoApp.Controls;

public sealed class HorizontalStrip : Grid
{
    private readonly StackPanel _panel = new() { Orientation = Orientation.Horizontal, Spacing = 4 };
    private readonly ScrollBar _bar = new()
    {
        Orientation = Orientation.Horizontal,
        Minimum = 0,
        SmallChange = 20,
        LargeChange = 100,
        Height = 16,
        Margin = new Thickness(0, 4, 0, 0),
        IsTabStop = false,
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
        RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var panelArea = new Grid();
        Grid.SetRow(panelArea, 0);
        panelArea.Children.Add(_panel);
        _panel.RenderTransform = new TranslateTransform();

        Grid.SetRow(_bar, 1);
        Children.Add(panelArea);
        Children.Add(_bar);

        SizeChanged += (_, _) =>
        {
            UpdateClip();
            _bar.ViewportSize = ActualWidth;
            var max = ComputeMax();
            if (max != _maxOffset)
            {
                UpdateMax(max);
            }
        };
        LayoutUpdated += (_, _) =>
        {
            var max = ComputeMax();
            if (max != _maxOffset)
            {
                UpdateMax(max);
            }
        };
        _bar.Scroll += (_, e) => SetOffset(e.NewValue);

        PointerWheelChanged += OnPointerWheelChanged;
        PointerPressed += OnPointerPressed;
        PointerMoved += OnPointerMoved;
        PointerReleased += OnPointerReleased;
        PointerCaptureLost += (_, _) => ResetDrag();
    }

    public void AddCard(FrameworkElement card) => _panel.Children.Add(card);

    private double ComputeMax()
    {
        if (_panel.ActualWidth < 0 || ActualWidth < 0)
        {
            return 0;
        }
        return Math.Max(0, _panel.ActualWidth - ActualWidth);
    }

    private void UpdateMax(double max)
    {
        _maxOffset = max;
        _bar.Maximum = max;
        if (_offset > max)
        {
            SetOffset(max);
        }
    }

    private void SetOffset(double value)
    {
        var v = Math.Clamp(value, 0, _maxOffset);
        if (Math.Abs(v - _offset) < 0.01)
        {
            return;
        }
        _offset = v;
        ((TranslateTransform)_panel.RenderTransform).X = -v;
        _bar.Value = v;
    }

    private void UpdateClip()
    {
        if (Children[0] is Grid panelArea)
        {
            panelArea.Clip = new RectangleGeometry
            {
                Rect = new Rect(0, 0, panelArea.ActualWidth, panelArea.ActualHeight),
            };
        }
    }

    private void OnPointerWheelChanged(object sender, PointerRoutedEventArgs e)
    {
        var props = e.GetCurrentPoint(this).Properties;
        var shiftDown = InputKeyboardSource.GetKeyStateForCurrentThread(VirtualKey.Shift)
            .HasFlag(CoreVirtualKeyStates.Down);
        if (props.IsHorizontalMouseWheel || shiftDown)
        {
            SetOffset(_offset + props.MouseWheelDelta);
        }
        else if (FindAncestorScrollViewer(this) is { } parent)
        {
            parent.ChangeView(null, parent.VerticalOffset - props.MouseWheelDelta, null, true);
        }
        e.Handled = true;
    }

    private static ScrollViewer? FindAncestorScrollViewer(DependencyObject start)
    {
        var parent = VisualTreeHelper.GetParent(start);
        while (parent is not null)
        {
            if (parent is ScrollViewer sv)
            {
                return sv;
            }
            parent = VisualTreeHelper.GetParent(parent);
        }
        return null;
    }

    private void OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        _pointerDown = true;
        _lastPoint = e.GetCurrentPoint(this).Position;
        _dragDistance = 0;
        _dragging = false;
    }

    private void OnPointerMoved(object sender, PointerRoutedEventArgs e)
    {
        if (!_pointerDown)
        {
            return;
        }
        var pos = e.GetCurrentPoint(this).Position;
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
            CapturePointer(e.Pointer);
        }
        SetOffset(_offset + dx);
        e.Handled = true;
    }

    private void OnPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        if (_dragging)
        {
            ReleasePointerCapture(e.Pointer);
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
