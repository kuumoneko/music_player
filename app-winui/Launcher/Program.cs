// Launcher for installed KuumoApp builds. The install dir only shows this exe
// plus the app\ payload folder; the real app (app\KuumoApp.exe) resolves every
// managed assembly from deps.json paths relative to its own directory, so the
// payload inside app\ is byte-identical to a flat install — no host surgery.
// Published as a single-file framework-dependent exe (requires the .NET
// Desktop Runtime, which the installer installs as a prerequisite).

using System.Diagnostics;
using System.Runtime.InteropServices;

namespace KuumoApp.Launcher;

internal static class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    private static int Main(string[] args)
    {
        var appDir = Path.Combine(AppContext.BaseDirectory, "app");
        var appExe = Path.Combine(appDir, "KuumoApp.exe");
        if (!File.Exists(appExe))
        {
            Fail($"app\\KuumoApp.exe not found at {appExe}");
            return 1;
        }

        var psi = new ProcessStartInfo(appExe)
        {
            WorkingDirectory = appDir,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var arg in args)
        {
            psi.ArgumentList.Add(arg);
        }

        try
        {
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            Fail($"failed to start {appExe}: {ex.Message}");
            return 1;
        }
        return 0;
    }

    private static void Fail(string message)
    {
        try
        {
            File.AppendAllText(
                Path.Combine(AppContext.BaseDirectory, "launcher-error.log"),
                $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}{Environment.NewLine}");
        }
        catch
        {
        }
        MessageBoxW(IntPtr.Zero, message, "KuumoApp", 0x10);
    }
}
