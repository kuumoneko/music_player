using System.Runtime.InteropServices;
using System.Threading;
using KuumoApp.Services;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

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
        UnhandledException += (_, e) =>
        {
            AppLog.Write("app", $"UNHANDLED: {e.Exception}");
        };
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        SynchronizationContext.SetSynchronizationContext(new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread()));
        SetCurrentProcessExplicitAppUserModelID("kuumo.app");
        MainWindow = new MainWindow();
        MainWindow.Activate();
        Services.Start();
    }

    public static void ShutdownApp()
    {
        AppLog.Write("app", "shutdown requested");
        Services.Shutdown();
        if (Current is App app)
        {
            app.Exit();
        }
    }
}
