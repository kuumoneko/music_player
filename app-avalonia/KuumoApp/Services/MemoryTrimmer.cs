using System.Runtime;
using System.Runtime.InteropServices;

namespace KuumoApp.Services;

public static class MemoryTrimmer
{
    [DllImport("kernel32.dll")]
    private static extern bool SetProcessWorkingSetSize(IntPtr proc, IntPtr min, IntPtr max);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("psapi.dll")]
    private static extern bool EmptyWorkingSet(IntPtr hProcess);

    private const long TargetMinBytes = 32L * 1024 * 1024;
    private const long TargetMaxBytes = 64L * 1024 * 1024;

    public static void TrimWorkingSet()
    {
        GCSettings.LargeObjectHeapCompactionMode = GCLargeObjectHeapCompactionMode.CompactOnce;
        GC.Collect(GC.MaxGeneration, GCCollectionMode.Aggressive, blocking: true, compacting: true);
        GC.WaitForPendingFinalizers();
        GCSettings.LargeObjectHeapCompactionMode = GCLargeObjectHeapCompactionMode.CompactOnce;
        GC.Collect(GC.MaxGeneration, GCCollectionMode.Aggressive, blocking: true, compacting: true);
        if (OperatingSystem.IsWindows())
        {
            EmptyWorkingSet(GetCurrentProcess());
            SetProcessWorkingSetSize(GetCurrentProcess(), (IntPtr)TargetMinBytes, (IntPtr)TargetMaxBytes);
        }
    }

    public static long WorkingSetBytes => Environment.WorkingSet;
}