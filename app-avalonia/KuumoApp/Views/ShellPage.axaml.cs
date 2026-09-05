using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class ShellPage : UserControl
{
    private static readonly Dictionary<string, Func<UserControl>> Pages = new()
    {
        ["home"] = () => new HomePage(),
        ["search"] = () => new SearchPage(),
        ["local"] = () => new LocalPage(),
        ["downloads"] = () => new DownloadsPage(),
        ["queue"] = () => new QueuePage(),
        ["settings"] = () => new SettingsPage(),
    };

    private static readonly Dictionary<string, string> PageTitles = new()
    {
        ["home"] = "Home",
        ["search"] = "Search",
        ["local"] = "Local",
        ["downloads"] = "Downloads",
        ["queue"] = "Play queue",
        ["settings"] = "Settings",
    };

    private readonly Stack<string> _backStack = new();
    private readonly Stack<string> _forwardStack = new();
    private string _currentTag = "home";
    private bool _suppressSelectionChange;

    public static ShellPage? Instance { get; private set; }

    public ShellPage()
    {
        InitializeComponent();
        Instance = this;
        NavigateTo("home");
    }

    public static void SetTitle(string? page)
    {
        if (App.MainWindow is { } window)
        {
            window.Title = string.IsNullOrWhiteSpace(page) ? "Kuumo App" : $"Kuumo App - {page}";
        }
    }

    public void SetStatus(string text)
    {
        if (StatusText is not null)
        {
            StatusText.Text = text;
        }
    }

    public void DetachContent()
    {
        if (ContentArea is not null)
        {
            ContentArea.Content = null;
        }
    }

    public void DetachNavContent()
    {
        if (NavList is not null)
        {
            NavList.ItemsSource = null;
            NavList.Items.Clear();
        }
    }

    public void RestoreContent()
    {
        NavigateTo(_currentTag);
    }

    public void RestoreNavContent()
    {
        if (NavList is null) return;
        NavList.Items.Clear();

        var navItems = new[]
        {
            CreateNavItem("home", "\uE80F", "Home", true),
            CreateNavItem("search", "\uE721", "Search", false),
            CreateNavItem("local", "\uE8B7", "Local", false),
            CreateNavItem("downloads", "\uE896", "Downloads", false),
            CreateNavItem("queue", "\uE7FC", "Play queue", false),
        };
        foreach (var item in navItems)
        {
            NavList.Items.Add(item);
        }
        SyncNavSelection(_currentTag);
    }

    private static ListBoxItem CreateNavItem(string tag, string icon, string label, bool isSelected)
    {
        var item = new ListBoxItem
        {
            Tag = tag,
            IsSelected = isSelected,
            Content = new StackPanel
            {
                Orientation = Avalonia.Layout.Orientation.Horizontal,
                Spacing = 12,
                Margin = new Thickness(0, 4),
                Children =
                {
                    new TextBlock
                    {
                        Text = icon,
                        FontFamily = new Avalonia.Media.FontFamily("Segoe MDL2 Assets"),
                        FontSize = 16,
                        VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center,
                        Width = 24,
                        HorizontalAlignment = Avalonia.Layout.HorizontalAlignment.Center,
                    },
                    new TextBlock
                    {
                        Text = label,
                        VerticalAlignment = Avalonia.Layout.VerticalAlignment.Center,
                        FontSize = 14,
                    },
                },
            },
        };
        return item;
    }

    public static void NavigateDetail(string source, string type, string id)
    {
        Instance?.NavigateToDetail(source, type, id);
    }

    public static void NavigateCollection(CollectionNav nav)
    {
        if (Instance is null) return;
        var page = new CollectionPage();
        page.LoadNav(nav);
        Instance.ContentArea.Content = page;
        Instance._backStack.Push(Instance._currentTag);
        Instance._forwardStack.Clear();
        Instance._currentTag = "__collection";
        Instance.ClearNavSelection();
        SetTitle(null);
    }

    public void NavigateToDetail(string source, string type, string id)
    {
        var detail = new DetailPage();
        detail.LoadNav(new DetailNav { Source = source, Type = type, Id = id });
        ContentArea.Content = detail;
        _backStack.Push(_currentTag);
        _forwardStack.Clear();
        _currentTag = "__detail";
        ClearNavSelection();
        SetTitle(null);
    }

    private void ClearNavSelection()
    {
        if (NavList is null) return;
        _suppressSelectionChange = true;
        NavList.SelectedItem = null;
        _suppressSelectionChange = false;
    }

    private void NavigateTo(string tag)
    {
        if (_currentTag != tag)
        {
            _backStack.Push(_currentTag);
            _forwardStack.Clear();
        }
        _currentTag = tag;
        if (Pages.TryGetValue(tag, out var factory))
        {
            ContentArea.Content = factory();
        }
        PageTitles.TryGetValue(tag, out var title);
        SetTitle(title);
    }

    public void GoBack()
    {
        if (_backStack.Count > 0)
        {
            var prev = _backStack.Pop();
            _forwardStack.Push(_currentTag);
            _currentTag = prev;
            if (Pages.TryGetValue(prev, out var factory))
            {
                ContentArea.Content = factory();
                PageTitles.TryGetValue(prev, out var title);
                SetTitle(title);
                SyncNavSelection(prev);
            }
            else
            {
                ContentArea.Content = Pages["home"]();
                _currentTag = "home";
                PageTitles.TryGetValue("home", out var homeTitle);
                SetTitle(homeTitle);
                SyncNavSelection("home");
            }
        }
    }

    public void GoForward()
    {
        if (_forwardStack.Count > 0)
        {
            var next = _forwardStack.Pop();
            _backStack.Push(_currentTag);
            _currentTag = next;
            if (Pages.TryGetValue(next, out var factory))
            {
                ContentArea.Content = factory();
                PageTitles.TryGetValue(next, out var title);
                SetTitle(title);
                SyncNavSelection(next);
            }
            else
            {
                ContentArea.Content = Pages["home"]();
                _currentTag = "home";
                PageTitles.TryGetValue("home", out var homeTitle);
                SetTitle(homeTitle);
                SyncNavSelection("home");
            }
        }
    }

    private void OnNavSelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (_suppressSelectionChange) return;
        if (NavList?.SelectedItem is ListBoxItem item && item.Tag is string tag)
        {
            NavigateTo(tag);
        }
    }

    private void OnHamburgerClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
    {
        NavSplit.IsPaneOpen = !NavSplit.IsPaneOpen;
    }

    private void SyncNavSelection(string tag)
    {
        if (NavList is null) return;
        _suppressSelectionChange = true;
        foreach (var item in NavList.Items)
        {
            if (item is ListBoxItem li && li.Tag as string == tag)
            {
                NavList.SelectedItem = li;
                break;
            }
        }
        _suppressSelectionChange = false;
    }

    private void OnKeyDown(object? sender, KeyEventArgs e)
    {
        var ctrl = e.KeyModifiers.HasFlag(KeyModifiers.Control);
        var alt = e.KeyModifiers.HasFlag(KeyModifiers.Alt);

        if (e.Key == Key.Space)
        {
            PlayerBar.TogglePlayPause();
            e.Handled = true;
            return;
        }

        if (ctrl)
        {
            switch (e.Key)
            {
                case Key.Left:
                    e.Handled = true;
                    _ = PlayerBar.PreviousAsync();
                    break;
                case Key.Right:
                    e.Handled = true;
                    _ = PlayerBar.NextAsync();
                    break;
                case Key.Up:
                    e.Handled = true;
                    PlayerBar.StepVolume(5);
                    break;
                case Key.Down:
                    e.Handled = true;
                    PlayerBar.StepVolume(-5);
                    break;
                case Key.M:
                    e.Handled = true;
                    PlayerBar.ToggleMute();
                    break;
                case Key.S:
                    e.Handled = true;
                    PlayerBar.ToggleShuffle();
                    break;
                case Key.R:
                    e.Handled = true;
                    PlayerBar.CycleRepeat();
                    break;
                case Key.B:
                    e.Handled = true;
                    NavSplit.IsPaneOpen = !NavSplit.IsPaneOpen;
                    break;
                case Key.F:
                    e.Handled = true;
                    NavigateTo("search");
                    if (ContentArea.Content is SearchPage sp)
                    {
                        sp.FocusSearch();
                    }
                    break;
            }
        }

        if (alt)
        {
            switch (e.Key)
            {
                case Key.Left:
                    e.Handled = true;
                    GoBack();
                    break;
                case Key.Right:
                    e.Handled = true;
                    GoForward();
                    break;
            }
        }
    }
}