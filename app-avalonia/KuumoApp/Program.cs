using Avalonia;
using KuumoApp.Services;
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace KuumoApp;

internal sealed class Program
{
    private static readonly bool IsDev = Environment.GetEnvironmentVariable("KUUMO_DEV") == "1";
    private static readonly string AppUserModelId = IsDev ? "KuumoAvalonia.dev" : "KuumoAvalonia";
    // Dev name must not collide with the installed app's "KuumoApp" Start Menu shortcut.
    private static readonly string DisplayName = IsDev ? "KuumoApp Avalonia Test" : "Kuumo Avalonia App";

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void SetCurrentProcessExplicitAppUserModelID(string appId);

    [STAThread]
    public static void Main(string[] args)
    {
        if (OperatingSystem.IsWindows())
        {
            try { SetCurrentProcessExplicitAppUserModelID(AppUserModelId); } catch { }
            RegisterAumidInRegistry();
            StartMenuHelper.EnsureShortcut();
            if (IsDev) AppDomain.CurrentDomain.ProcessExit += (_, _) => CleanupDevArtifacts();
            if (!IsDev)
                TryRegisterSparsePackage();
        }

        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    // Dev artifacts are ours to remove, but only if we survive long enough to do it:
    // a hard kill (Stop-Process) never raises ProcessExit, so scripts/avalonia-dev.ts
    // sweeps the same two items on teardown and at the start of the next run.
    private static void CleanupDevArtifacts()
    {
        if (!IsDev) return;
        try
        {
            StartMenuHelper.RemoveDevArtifacts();
            Registry.CurrentUser.DeleteSubKeyTree($@"Software\Classes\AppUserModelId\{AppUserModelId}", false);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[dev-cleanup] {ex.Message}");
        }
    }

    private static void RegisterAumidInRegistry()
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey($@"Software\Classes\AppUserModelId\{AppUserModelId}");
            key?.SetValue("DisplayName", DisplayName, RegistryValueKind.String);
            key?.SetValue("IconUri", Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico"), RegistryValueKind.String);
        }
        catch
        {
            // Best-effort
        }
    }

    private static void TryRegisterSparsePackage()
    {
        try
        {
            var msixPath = Path.Combine(AppContext.BaseDirectory, "kuumo-identity.msix");
            if (!File.Exists(msixPath))
            {
                var buildDir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build");
                msixPath = Path.GetFullPath(Path.Combine(buildDir, "kuumo-identity.msix"));
            }

            if (!File.Exists(msixPath)) return;

            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -Command \"Add-AppxPackage -Path '{msixPath}' -ExternalLocation '{AppContext.BaseDirectory}'\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            var proc = Process.Start(psi);
            if (proc == null) return;
            proc.WaitForExit(15000);
        }
        catch { }
    }

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .LogToTrace();
}
