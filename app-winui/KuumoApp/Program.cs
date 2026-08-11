// Custom entry point for the framework-dependent Windows App SDK deployment.
//
// Installed builds keep every DLL (managed + native) inside {app}\include, so
// this Main redirects assembly/native resolution to that folder before WinUI
// starts. Dev builds (winui:dev) are flat-layout: both fallbacks are no-ops
// there, so nothing changes for development.
//
// The Windows App SDK runtime is installed machine-wide by setup.iss; we
// initialize it via the Bootstrap API. The version constant below (0x00020003
// = Windows App SDK 2.3) MUST stay in sync with the Microsoft.WindowsAppSDK
// package version in KuumoApp.csproj.

using System.Runtime.InteropServices;
using System.Runtime.Loader;
using Microsoft.UI.Xaml;

namespace KuumoApp;

public static class Program
{
    private const uint LoadLibrarySearchDefaultDirs = 0x00001000;

    // Windows App SDK runtime version, packed as 0xMMMMmmmm (major=2, minor=3).
    private const uint WindowsAppSdkVersion = 0x00020003;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetDefaultDllDirectories(uint directoryFlags);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AddDllDirectory(string lpPathName);

    [DllImport("Microsoft.WindowsAppRuntime.Bootstrap.dll")]
    private static extern int MddBootstrapInitialize(uint majorMinorVersion, IntPtr versionTag, IntPtr minVersion);

    [DllImport("Microsoft.WindowsAppRuntime.Bootstrap.dll")]
    private static extern void MddBootstrapShutdown();

    [DllImport("Microsoft.ui.xaml.dll")]
    private static extern void XamlCheckProcessRequirements();

    [STAThread]
    private static int Main()
    {
        var baseDir = AppContext.BaseDirectory;
        var includeDir = Path.Combine(baseDir, "include");

        // Native DLLs (Bootstrap, WebView2Loader, ...) live in include\ on
        // installed builds. Missing dir (flat dev layout) is a harmless no-op.
        if (Directory.Exists(includeDir))
        {
            SetDefaultDllDirectories(LoadLibrarySearchDefaultDirs);
            AddDllDirectory(includeDir);
        }

        // Managed DLLs (Microsoft.Windows.SDK.NET, WinRT.Runtime, WebView2.Core,
        // CommunityToolkit, H.NotifyIcon, ...) also live in include\. Fall back
        // to default probing when not found there (flat dev layout).
        AssemblyLoadContext.Default.Resolving += (ctx, name) =>
        {
            if (!Directory.Exists(includeDir)) return null;
            var path = Path.Combine(includeDir, name.Name + ".dll");
            return File.Exists(path) ? ctx.LoadFromAssemblyPath(path) : null;
        };

        var hr = MddBootstrapInitialize(WindowsAppSdkVersion, IntPtr.Zero, IntPtr.Zero);
        if (hr < 0)
        {
            throw new InvalidOperationException(
                $"Windows App SDK bootstrap failed (0x{hr:X8}). Reinstall KuumoApp to install the Windows App Runtime.");
        }
        AppDomain.CurrentDomain.ProcessExit += (_, _) => MddBootstrapShutdown();

        XamlCheckProcessRequirements();
        Application.Start(_ => new App());
        return 0;
    }
}
