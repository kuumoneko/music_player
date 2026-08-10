namespace KuumoApp.Services;

public static class AppLog
{
    private static readonly string LogDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "KuumoApp");

    private static readonly object Sync = new();

    static AppLog()
    {
        Directory.CreateDirectory(LogDir);
    }

    public static string LogFilePath => Path.Combine(LogDir, "app.log");

    public static void Write(string source, string message)
    {
        var line = $"{DateTime.Now:HH:mm:ss.fff} [{source}] {message}";
        lock (Sync)
        {
            try
            {
                File.AppendAllText(LogFilePath, line + Environment.NewLine);
            }
            catch
            {
            }
        }
        System.Diagnostics.Debug.WriteLine(line);
    }
}
