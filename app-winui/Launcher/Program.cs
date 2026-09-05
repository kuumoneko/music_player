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
        var logFile = Path.Combine(AppContext.BaseDirectory, "launcher-error.log");

        File.WriteAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Launcher started, appExe={appExe}\r\n");

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
            RedirectStandardError = true,
            RedirectStandardOutput = true,
        };
        foreach (var arg in args)
        {
            psi.ArgumentList.Add(arg);
        }

        try
        {
            var proc = Process.Start(psi);
            if (proc is null)
            {
                Fail($"Process.Start returned null for {appExe}");
                return 1;
            }

            File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Child process started (pid={proc.Id})\r\n");

            var stderr = proc.StandardError.ReadToEndAsync();
            var stdout = proc.StandardOutput.ReadToEndAsync();

            if (!proc.WaitForExit(15000))
            {
                File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Child process did not exit within 15s, assuming OK\r\n");
                return 0;
            }

            var errText = stderr.Result;
            var outText = stdout.Result;

            if (!string.IsNullOrWhiteSpace(errText))
            {
                File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} child stderr: {errText}\r\n");
            }
            if (!string.IsNullOrWhiteSpace(outText))
            {
                File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} child stdout: {outText}\r\n");
            }

            if (proc.ExitCode != 0 && proc.ExitCode != 42)
            {
                File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Child exited with code {proc.ExitCode}\r\n");
            }
            else
            {
                File.AppendAllText(logFile, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} Child exited normally (code={proc.ExitCode})\r\n");
            }

            return proc.ExitCode;
        }
        catch (Exception ex)
        {
            Fail($"failed to start {appExe}: {ex.Message}");
            return 1;
        }
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
