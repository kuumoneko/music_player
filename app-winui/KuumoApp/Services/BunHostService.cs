using System.Diagnostics;

namespace KuumoApp.Services;

public sealed class BunHostService
{
    private Process? _process;
    private int _restartCount;
    private bool _stopping;

    public event Action<string>? EndpointReady;
    public event Action<string>? LogLine;
    public event Action? SingleInstanceDetected;

    public bool IsDev => Environment.GetEnvironmentVariable("KUUMO_DEV") == "1";

    public string BackendDir { get; }
    public string DataDir { get; }
    public string AssetsDir { get; }

    public BunHostService()
    {
        BackendDir = Environment.GetEnvironmentVariable("KUUMO_BACKEND_DIR")
            ?? Path.Combine(AppContext.BaseDirectory, "backend");
        DataDir = Environment.GetEnvironmentVariable("KUUMO_DATA_DIR")
            ?? GetDefaultDataDir();
        AssetsDir = Environment.GetEnvironmentVariable("KUUMO_ASSETS_DIR")
            ?? AppContext.BaseDirectory;
    }

    private static string GetDefaultDataDir()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "musicapp");
    }

    private static string ResolveBunExe()
    {
        var bundled = Path.Combine(AppContext.BaseDirectory, "bun.exe");
        return File.Exists(bundled) ? bundled : "bun";
    }

    public void Start()
    {
        if (_process is { HasExited: false })
        {
            return;
        }

        var entry = Path.Combine(BackendDir, "backend.js");
        if (!File.Exists(entry))
        {
            Log($"backend.js not found at {entry}");
            return;
        }

        var psi = new ProcessStartInfo(ResolveBunExe())
        {
            WorkingDirectory = BackendDir,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add(entry);
        psi.ArgumentList.Add("--data-dir");
        psi.ArgumentList.Add(DataDir);
        psi.ArgumentList.Add("--assets");
        psi.ArgumentList.Add(AssetsDir);
        if (IsDev)
        {
            psi.ArgumentList.Add("--no-lock");
            psi.ArgumentList.Add("--port");
            psi.ArgumentList.Add("0");
        }

        _process = Process.Start(psi);
        if (_process is null)
        {
            Log("failed to start bun process");
            return;
        }
        Log($"args: {psi.FileName} {string.Join(' ', psi.ArgumentList)}");
        _process.EnableRaisingEvents = true;
        _process.OutputDataReceived += OnOutput;
        _process.ErrorDataReceived += OnError;
        _process.Exited += OnExited;
        _process.BeginOutputReadLine();
        _process.BeginErrorReadLine();
        Log($"started (pid={_process.Id}, dir={BackendDir}, dev={IsDev})");
    }

    private void OnOutput(object? sender, DataReceivedEventArgs e)
    {
        if (string.IsNullOrEmpty(e.Data))
        {
            return;
        }
        var line = e.Data;
        if (line.StartsWith("KUUMO_WS=", StringComparison.Ordinal))
        {
            _restartCount = 0;
            EndpointReady?.Invoke(line["KUUMO_WS=".Length..]);
        }
        Log(line);
    }

    private void OnError(object? sender, DataReceivedEventArgs e)
    {
        if (!string.IsNullOrEmpty(e.Data))
        {
            Log($"stderr: {e.Data}");
        }
    }

    private void OnExited(object? sender, EventArgs e)
    {
        var exitCode = _process?.ExitCode;
        if (_stopping)
        {
            return;
        }
        if (exitCode == 42)
        {
            Log("another instance is already running (exit 42), not restarting");
            SingleInstanceDetected?.Invoke();
            return;
        }
        _restartCount++;
        var delay = Math.Min(_restartCount * 2, 10);
        Log($"backend exited (code={exitCode}), restarting in {delay}s (attempt {_restartCount})");
        Task.Delay(TimeSpan.FromSeconds(delay)).ContinueWith(_ =>
        {
            if (!_stopping)
            {
                Start();
            }
        });
    }

    public void Stop()
    {
        _stopping = true;
        if (_process is { HasExited: false })
        {
            try
            {
                _process.Kill(entireProcessTree: true);
            }
            catch
            {
            }
        }
        _process?.Dispose();
        _process = null;
        Log("stopped");
    }

    private void Log(string message)
    {
        AppLog.Write("bun-host", message);
        LogLine?.Invoke(message);
    }
}
