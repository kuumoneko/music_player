using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
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
        ToastService.Initialize(ToastPopup, ToastBorder, ToastText, ToastAction);
        MainFrame = ContentFrame;
        Nav.SelectedItem = Nav.MenuItems[0];
        ContentFrame.Navigated += OnNavigated;
        App.Services.ConnectionChanged += OnConnectionChanged;
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
        else if (e.Key == VirtualKey.Escape)
        {
            if (ContentFrame.CanGoBack)
            {
                e.Handled = true;
                ContentFrame.GoBack();
            }
        }
    }

    private void OnToastActionClick(object sender, RoutedEventArgs e) => ToastService.InvokeAction();

    private static readonly (string Keys, string Action)[] Shortcuts =
    [
        ("Space", "Play / pause"),
        ("Ctrl + F", "Focus the search box"),
        ("Ctrl + S", "Toggle shuffle"),
        ("Ctrl + R", "Cycle repeat mode"),
        ("Ctrl + M", "Mute / unmute"),
        ("Ctrl + Up / Down", "Volume up / down"),
        ("Ctrl + Left / Right", "Previous / next track"),
        ("Alt + Left / Right", "Back / forward"),
        ("Esc", "Back"),
    ];

    private void OnHelpClick(object sender, RoutedEventArgs e)
    {
        var panel = new StackPanel { Spacing = 8, Padding = new Thickness(4) };
        panel.Children.Add(new TextBlock
        {
            Text = "Keyboard shortcuts",
            FontSize = 16,
            Margin = new Thickness(0, 0, 0, 4),
        });
        foreach (var (keys, action) in Shortcuts)
        {
            var row = new Grid { ColumnSpacing = 16 };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(150) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.Children.Add(new TextBlock
            {
                Text = keys,
                FontFamily = new FontFamily("Consolas"),
                Opacity = 0.85,
            });
            var label = new TextBlock { Text = action, TextWrapping = TextWrapping.Wrap };
            Grid.SetColumn(label, 1);
            row.Children.Add(label);
            panel.Children.Add(row);
        }
        var flyout = new Flyout
        {
            Content = new ScrollViewer
            {
                Content = panel,
                MaxHeight = 420,
                Padding = new Thickness(4),
            },
        };
        flyout.ShowAt(sender as FrameworkElement ?? HelpButton);
    }

    private void OnConnectionChanged(bool connected)
    {
        DispatcherQueue.TryEnqueue(() => ConnectionBar.IsOpen = !connected);
    }

    private async void OnConnectionRetryClick(object sender, RoutedEventArgs e)
    {
        ConnectionBar.Message = "Retrying...";
        await App.Services.RetryAsync();
        if (App.Services.Rpc.IsConnected)
        {
            ConnectionBar.IsOpen = false;
        }
        else
        {
            ConnectionBar.Message = "Reconnecting automatically - playback and downloads are paused until it returns.";
        }
    }

    // First navigation waits for the backend so the last-visited page can be restored from sqlite.
    private bool _restored;

    private async void OnRootLoaded(object sender, RoutedEventArgs e)
    {
        if (_restored)
        {
            return;
        }
        _restored = true;
        var startTag = "home";
        try
        {
            await WaitForRpcAsync();
            var saved = await App.Services.Api.GetUserDataAsync<UiStateDto>(UserDataKeys.UiState);
            if (saved is not null && Pages.ContainsKey(saved.Page))
            {
                startTag = saved.Page;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("shell", $"uiState restore failed: {ex.GetType().Name}: {ex.Message}");
        }
        if (Pages.TryGetValue(startTag, out var page))
        {
            ContentFrame.Navigate(page);
        }
    }

    private static async Task WaitForRpcAsync()
    {
        if (App.Services.Rpc.IsConnected)
        {
            return;
        }
        var tcs = new TaskCompletionSource();
        Action handler = null!;
        handler = () => tcs.TrySetResult();
        App.Services.Rpc.Connected += handler;
        try
        {
            await tcs.Task.WaitAsync(TimeSpan.FromSeconds(15));
        }
        catch (TimeoutException)
        {
        }
        finally
        {
            App.Services.Rpc.Connected -= handler;
        }
    }

    private void PersistUiState(string tag)
    {
        _ = App.Services.Api.SetUserDataAsync(UserDataKeys.UiState, new UiStateDto(tag));
    }

    private void OnNavigated(object sender, NavigationEventArgs e)
    {
        if (e.SourcePageType == typeof(SettingsPage))
        {
            Nav.SelectedItem = Nav.SettingsItem;
            SetTitle(PageTitles[typeof(SettingsPage)]);
            UpdateNavButtons();
            PersistUiState("settings");
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
            PersistUiState(tag);
        }
        else
        {
            SetTitle(null);
        }
        UpdateNavButtons();
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

    private void OnNavBackRequested(NavigationView sender, NavigationViewBackRequestedEventArgs args)
    {
        if (ContentFrame.CanGoBack)
        {
            ContentFrame.GoBack();
        }
    }

    private void OnBackClick(object sender, RoutedEventArgs e)
    {
        if (ContentFrame.CanGoBack)
        {
            ContentFrame.GoBack();
        }
    }

    private void OnForwardClick(object sender, RoutedEventArgs e)
    {
        if (ContentFrame.CanGoForward)
        {
            ContentFrame.GoForward();
        }
    }

    private void UpdateNavButtons()
    {
        BackButton.IsEnabled = ContentFrame.CanGoBack;
        ForwardButton.IsEnabled = ContentFrame.CanGoForward;
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
