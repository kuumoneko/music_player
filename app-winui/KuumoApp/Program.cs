// Custom entry point for the framework-dependent Windows App SDK deployment.
//
// Installed builds use a FLAT layout: every managed assembly sits at the app
// root (KuumoApp.deps.json resolves them from there — verified via
// COREHOST_TRACE that the host strips subfolder prefixes and never falls back
// to loose probing; Microsoft.WinUI also loads at JIT time, before this Main
// can attach any AssemblyResolve handler). Only the backend's native libs live
// in include\, loaded by backend.exe itself, never by the .NET host.
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
        var crashLog = Path.Combine(baseDir, "crash.log");
        try
        {
            return InnerMain(baseDir, crashLog);
        }
        catch (Exception ex)
        {
            File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} FATAL: {ex}\r\n");
            return 1;
        }
    }

    private static int InnerMain(string baseDir, string crashLog)
    {
        File.WriteAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Main() started, baseDir={baseDir}\r\n");

        var includeDir = Path.Combine(baseDir, "include");
        File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} includeDir={includeDir}, exists={Directory.Exists(includeDir)}\r\n");

        if (Directory.Exists(includeDir))
        {
            SetDefaultDllDirectories(LoadLibrarySearchDefaultDirs);
            AddDllDirectory(includeDir);
            File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Added DLL directory: {includeDir}\r\n");
        }

        AssemblyLoadContext.Default.Resolving += (ctx, name) =>
        {
            if (!Directory.Exists(includeDir)) return null;
            var path = Path.Combine(includeDir, name.Name + ".dll");
            return File.Exists(path) ? ctx.LoadFromAssemblyPath(path) : null;
        };

        var bootstrapDll = Path.Combine(baseDir, "Microsoft.WindowsAppRuntime.Bootstrap.dll");
        File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Bootstrap DLL: {bootstrapDll}, exists={File.Exists(bootstrapDll)}\r\n");

        var hr = MddBootstrapInitialize(WindowsAppSdkVersion, IntPtr.Zero, IntPtr.Zero);
        File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} MddBootstrapInitialize hr=0x{hr:X8}\r\n");
        if (hr < 0)
        {
            File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} WinAppSDK bootstrap FAILED. Reinstall KuumoApp to install the Windows App Runtime.\r\n");
            throw new InvalidOperationException(
                $"Windows App SDK bootstrap failed (0x{hr:X8}). Reinstall KuumoApp to install the Windows App Runtime.");
        }
        AppDomain.CurrentDomain.ProcessExit += (_, _) => MddBootstrapShutdown();

        XamlCheckProcessRequirements();
        File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Starting XAML application...\r\n");
        Application.Start(_ => new App());
        File.AppendAllText(crashLog, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Application.Start returned\r\n");
        return 0;
    }
}
