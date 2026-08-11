using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;
using Windows.Foundation;
using Windows.System;

namespace KuumoApp.Views;

public sealed partial class ShellPage : Page
{
    private static readonly Dictionary<string, Type> Pages = new()
    {
        ["home"] = typeof(HomePage),
        ["search"] = typeof(SearchPage),
        ["local"] = typeof(LocalPage),
        ["downloads"] = typeof(DownloadsPage),
        ["queue"] = typeof(QueuePage),
        ["settings"] = typeof(SettingsPage),
    };

    private static readonly Dictionary<Type, string> PageTitles = new()
    {
        [typeof(HomePage)] = "Home",
        [typeof(SearchPage)] = "Search",
        [typeof(LocalPage)] = "Local",
        [typeof(DownloadsPage)] = "Downloads",
        [typeof(QueuePage)] = "Play queue",
        [typeof(SettingsPage)] = "Settings",
    };

    public static Frame? MainFrame { get; private set; }

    public static void SetTitle(string? page)
    {
        if (App.MainWindow is { } window)
        {
            window.Title = string.IsNullOrWhiteSpace(page) ? "Kuumo App" : $"Kuumo App - {page}";
        }
    }

    public ShellPage()
    {
        InitializeComponent();
        MainFrame = ContentFrame;
        Nav.SelectedItem = Nav.MenuItems[0];
        ContentFrame.Navigated += OnNavigated;
        ContentFrame.Navigate(typeof(HomePage));
        KeyDown += OnRootKeyDown;
        AddAltAccelerator(VirtualKey.Left, OnBackAccelerator);
        AddAltAccelerator(VirtualKey.Right, OnForwardAccelerator);
    }

    // Space toggles play/pause only when no focused control consumed the key.
    // TextBox/Button/etc. mark Space handled during bubbling, so typing in the
    // search box (or activating a button) never reaches this handler.
    private void OnRootKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == VirtualKey.Space)
        {
            e.Handled = true;
            PlayerBar.TogglePlayPause();
        }
    }

    private void OnNavigated(object sender, NavigationEventArgs e)
    {
        if (e.SourcePageType == typeof(SettingsPage))
        {
            Nav.SelectedItem = Nav.SettingsItem;
            SetTitle(PageTitles[typeof(SettingsPage)]);
            return;
        }
        var tag = Pages.FirstOrDefault(kv => kv.Value == e.SourcePageType).Key;
        var item = tag is null
            ? null
            : Nav.MenuItems.OfType<NavigationViewItem>().FirstOrDefault(i => (i.Tag as string) == tag);
        if (!ReferenceEquals(Nav.SelectedItem, item))
        {
            Nav.SelectedItem = item;
        }
        if (tag is not null)
        {
            SetTitle(PageTitles[e.SourcePageType]);
        }
        else
        {
            SetTitle(null);
        }
    }

    private void AddAltAccelerator(VirtualKey key, TypedEventHandler<KeyboardAccelerator, KeyboardAcceleratorInvokedEventArgs> handler)
    {
        var accel = new KeyboardAccelerator
        {
            Key = key,
            Modifiers = VirtualKeyModifiers.Menu,
        };
        accel.Invoked += handler;
        KeyboardAccelerators.Add(accel);
    }

    public void SetStatus(string text)
    {
        StatusText.Text = text;
    }

    public static void NavigateDetail(string source, string type, string id)
    {
        MainFrame?.Navigate(typeof(DetailPage), new DetailNav(source, type, id));
    }

    private void OnNavItemInvoked(NavigationView sender, NavigationViewItemInvokedEventArgs args)
    {
        var tag = args.IsSettingsInvoked
            ? "settings"
            : (args.InvokedItemContainer?.Tag as string)?.ToLowerInvariant();
        if (tag is not null && Pages.TryGetValue(tag, out var page))
        {
            ContentFrame.Navigate(page);
        }
    }

    private void OnPrevAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        _ = PlayerBar.PreviousAsync();
    }

    private void OnNextAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        _ = PlayerBar.NextAsync();
    }

    private void OnVolumeUpAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        PlayerBar.StepVolume(5);
    }

    private void OnVolumeDownAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        PlayerBar.StepVolume(-5);
    }

    private void OnMuteAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        PlayerBar.ToggleMute();
    }

    private void OnShuffleAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        PlayerBar.ToggleShuffle();
    }

    private void OnRepeatAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        PlayerBar.CycleRepeat();
    }

    private void OnSearchAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        args.Handled = true;
        var searchItem = Nav.MenuItems.OfType<NavigationViewItem>().FirstOrDefault(i => (i.Tag as string) == "search");
        if (searchItem is not null)
        {
            Nav.SelectedItem = searchItem;
        }
        if (ContentFrame.Content is not SearchPage)
        {
            ContentFrame.Navigate(typeof(SearchPage));
        }
        if (ContentFrame.Content is SearchPage searchPage)
        {
            searchPage.FocusSearch();
        }
    }

    private void OnBackAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        if (ContentFrame.CanGoBack)
        {
            args.Handled = true;
            ContentFrame.GoBack();
        }
    }

    private void OnForwardAccelerator(KeyboardAccelerator sender, KeyboardAcceleratorInvokedEventArgs args)
    {
        if (ContentFrame.CanGoForward)
        {
            args.Handled = true;
            ContentFrame.GoForward();
        }
    }
}
