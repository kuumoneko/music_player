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
        var includeDir = Path.Combine(baseDir, "include");

        // Backend native libs (ffmpeg/mpv) live in include\; adding it to the
        // LoadLibrary search is harmless when the dir is absent (flat dev run).
        if (Directory.Exists(includeDir))
        {
            SetDefaultDllDirectories(LoadLibrarySearchDefaultDirs);
            AddDllDirectory(includeDir);
        }

        // Safety net for loose assemblies; the flat payload resolves everything
        // through deps.json, so this normally never fires.
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
