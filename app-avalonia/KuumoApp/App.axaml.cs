using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using Avalonia.Threading;
using KuumoApp.Services;
using KuumoApp.Views;

namespace KuumoApp;

public partial class App : Application
{
    private static AppServices? _services;

    public static AppServices Services => _services ?? throw new InvalidOperationException("AppServices not initialized");
    public static Window? MainWindow { get; set; }

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            _services = new AppServices();

            var mainWindow = new MainWindow();
            desktop.MainWindow = mainWindow;
            MainWindow = mainWindow;

            // Initialize services after window is created
            _ = InitializeAsync(mainWindow);
        }

        base.OnFrameworkInitializationCompleted();
    }

    private static async Task InitializeAsync(MainWindow mainWindow)
    {
        try
        {
            _services!.Window = new WindowService(mainWindow, _services.Rpc);
            await _services.InitializeAsync();
            await _services.Window.InitializeAsync();
            AppLog.Write("app", "Application initialized successfully");
        }
        catch (Exception ex)
        {
            AppLog.Write("app", $"Initialization failed: {ex.Message}");
        }
    }

    public static void ShutdownApp()
    {
        AppLog.Write("app", "shutdown requested");
        _services?.Shutdown();
        Dispatcher.UIThread.Post(() =>
        {
            if (Application.Current?.ApplicationLifetime
                is IClassicDesktopStyleApplicationLifetime desktop)
            {
                desktop.Shutdown();
            }
        });
    }
}