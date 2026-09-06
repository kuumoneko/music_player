using System.Runtime.InteropServices;
using System.Threading;
using KuumoApp.Services;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace KuumoApp;

public partial class App : Application
{
    public static Window? MainWindow { get; private set; }
    public static Services.AppServices Services { get; } = new();

    [DllImport("shell32.dll")]
    private static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string appID);

    public App()
    {
        InitializeComponent();
        var crashLog = Path.Combine(AppContext.BaseDirectory, "crash.log");
        File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} App() constructor\r\n");
        UnhandledException += async (_, e) =>
        {
            var full = e.Exception.ToString();
            AppLog.Write("app", $"UNHANDLED: {full}");
            File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} UNHANDLED: {full}\r\n");
            try
            {
                var dialog = new ContentDialog
                {
                    Title = "KuumoApp crashed",
                    Content = e.Exception.Message,
                    PrimaryButtonText = "OK",
                    DefaultButton = ContentDialogButton.Primary,
                    XamlRoot = MainWindow?.Content?.XamlRoot
                };
                if (dialog.XamlRoot is not null)
                {
                    await dialog.ShowAsync();
                }
            }
            catch { }
            e.Handled = true;
        };
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        SynchronizationContext.SetSynchronizationContext(new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread()));
        SetCurrentProcessExplicitAppUserModelID("kuumo.app");
        MainWindow = new MainWindow();
        Services.Start();
    }

    public static void ShutdownApp()
    {
        AppLog.Write("app", $"shutdown requested (stack trace: {Environment.StackTrace})");
        Services.Shutdown();
        if (Current is App app)
        {
            app.Exit();
        }
    }
}
