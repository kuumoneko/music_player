using System.Runtime.InteropServices;
using KuumoApp.Services;

namespace KuumoApp;

internal static class StartMenuHelper
{
    private const string AppUserModelId = "KuumoApp";
    private const string DisplayName = "Kuumo App";

    [ComImport]
    [Guid("00021401-0000-0000-c000-000000000046")]
    private class ShellLink { }

    [ComImport]
    [Guid("000214F9-0000-0000-c000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszFile, int cch, IntPtr pfd, int fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszName, int cch);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszDir, int cch);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszArgs, int cch);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszIconPath, int cch, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
        void Resolve(IntPtr hwnd, int fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }

    [ComImport]
    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        void GetCount(out uint cProps);
        void GetAt(uint iProp, out PropertyKey pkey);
        void GetValue(ref PropertyKey key, out PropVariant pv);
        void SetValue(ref PropertyKey key, ref PropVariant pv);
        void Commit();
    }

    [ComImport]
    [Guid("0000010b-0000-0000-c000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPersistFile
    {
        void GetClassID(out Guid pClassID);
        void IsDirty();
        void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, int dwMode);
        void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
        void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PropertyKey
    {
        public Guid fmtid;
        public uint pid;

        public PropertyKey(Guid fmtid, uint pid)
        {
            this.fmtid = fmtid;
            this.pid = pid;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PropVariant
    {
        public ushort vt;
        public ushort wReserved1;
        public ushort wReserved2;
        public ushort wReserved3;
        public IntPtr val;

        public void SetString(string value)
        {
            vt = 31;
            val = Marshal.StringToCoTaskMemUni(value);
        }

        public void Clear()
        {
            if (vt == 31 && val != IntPtr.Zero)
            {
                Marshal.FreeCoTaskMem(val);
                val = IntPtr.Zero;
            }
        }
    }

    private static readonly PropertyKey AppUserModelIdKey = new(
        new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 5);

    [UnmanagedFunctionPointer(System.Runtime.InteropServices.CallingConvention.Winapi)]
    private delegate int SetValueFn(IntPtr thisPtr, IntPtr keyPtr, IntPtr pvPtr);

    [UnmanagedFunctionPointer(System.Runtime.InteropServices.CallingConvention.Winapi)]
    private delegate int GetValueFn(IntPtr thisPtr, IntPtr keyPtr, IntPtr pvPtr);

    [UnmanagedFunctionPointer(System.Runtime.InteropServices.CallingConvention.Winapi)]
    private delegate int CommitFn(IntPtr thisPtr);

    private static int RawSetValueOnMta(object comObject, string value)
    {
        int result = -1;
        Exception? threadEx = null;
        var thread = new Thread(() =>
        {
            try
            {
                var psPtr = Marshal.GetComInterfaceForObject(comObject, typeof(IPropertyStore));
                try
                {
                    var key = AppUserModelIdKey;
                    var pkPtr = Marshal.AllocHGlobal(20);
                    try
                    {
                        Marshal.StructureToPtr(key, pkPtr, false);
                        var strPtr = Marshal.StringToCoTaskMemUni(value);
                        try
                        {
                            var pvPtr = Marshal.AllocHGlobal(16);
                            try
                            {
                                Marshal.WriteInt16(pvPtr, 0, 31);
                                Marshal.WriteIntPtr(pvPtr, 8, strPtr);
                                var vtable = Marshal.ReadIntPtr(psPtr);
                                var setValueAddr = Marshal.ReadIntPtr(vtable, 6 * IntPtr.Size);
                                var setValue = Marshal.GetDelegateForFunctionPointer<SetValueFn>(setValueAddr);
                                result = setValue(psPtr, pkPtr, pvPtr);
                                var commitAddr = Marshal.ReadIntPtr(vtable, 7 * IntPtr.Size);
                                var commit = Marshal.GetDelegateForFunctionPointer<CommitFn>(commitAddr);
                                commit(psPtr);
                            }
                            finally
                            {
                                Marshal.FreeHGlobal(pvPtr);
                            }
                        }
                        finally
                        {
                            Marshal.FreeCoTaskMem(strPtr);
                        }
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(pkPtr);
                    }
                }
                finally
                {
                    Marshal.Release(psPtr);
                }
            }
            catch (Exception ex)
            {
                threadEx = ex;
            }
        });
        thread.SetApartmentState(ApartmentState.MTA);
        thread.Start();
        thread.Join();
        if (threadEx != null) throw threadEx;
        return result;
    }

    public static void EnsureShortcut()
    {
        if (!OperatingSystem.IsWindows()) return;
        try
        {
            var exePath = Environment.ProcessPath;
            if (string.IsNullOrEmpty(exePath))
            {
                AppLog.Write("shortcut", "exe path is null");
                return;
            }

            var startMenuDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                @"Microsoft\Windows\Start Menu\Programs");
            var shortcutPath = Path.Combine(startMenuDir, $"{DisplayName}.lnk");
            var iconPath = Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico");

            Console.Error.WriteLine($"[shortcut] exe={exePath} shortcut={shortcutPath} icon={iconPath}");

            CleanupOldShortcuts(startMenuDir, shortcutPath);

            if (File.Exists(shortcutPath))
            {
                var valid = IsShortcutValid(shortcutPath);
                Console.Error.WriteLine($"[shortcut] existing shortcut valid={valid}");
                if (valid) return;
                File.Delete(shortcutPath);
            }

            CreateShortcut(shortcutPath, exePath, iconPath);
            Console.Error.WriteLine($"[shortcut] created: exists={File.Exists(shortcutPath)}");
        }
        catch (Exception ex)
        {
            AppLog.Write("shortcut", $"failed: {ex.Message}");
        }
    }

    private static void CleanupOldShortcuts(string startMenuDir, string keepPath)
    {
        try
        {
            foreach (var lnk in Directory.GetFiles(startMenuDir, "*.lnk"))
            {
                if (string.Equals(lnk, keepPath, StringComparison.OrdinalIgnoreCase))
                    continue;

                if (HasMatchingAumid(lnk))
                {
                    AppLog.Write("shortcut", $"deleting stale shortcut: {Path.GetFileName(lnk)}");
                    File.Delete(lnk);
                }
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("shortcut", $"cleanup error: {ex.Message}");
        }
    }

    private static bool HasMatchingAumid(string shortcutPath)
    {
        object? link = null;
        try
        {
            link = new ShellLink();
            var persistFile = (IPersistFile)link;
            persistFile.Load(shortcutPath, 0);

            var propertyStore = (IPropertyStore)link;
            var aumidKey = AppUserModelIdKey;
            propertyStore.GetValue(ref aumidKey, out var pv);
            try
            {
                if (pv.vt != 31) return false;
                var currentAumid = Marshal.PtrToStringUni(pv.val);
                return currentAumid == AppUserModelId;
            }
            finally
            {
                pv.Clear();
            }
        }
        catch
        {
            return false;
        }
        finally
        {
            if (link != null) Marshal.ReleaseComObject(link);
        }
    }

    private static bool IsShortcutValid(string shortcutPath)
    {
        object? link = null;
        try
        {
            link = new ShellLink();
            var persistFile = (IPersistFile)link;
            persistFile.Load(shortcutPath, 0);

            var shellLink = (IShellLinkW)link;

            var descBuilder = new System.Text.StringBuilder(260);
            shellLink.GetDescription(descBuilder, descBuilder.Capacity);
            var desc = descBuilder.ToString();
            if (desc != DisplayName)
            {
                AppLog.Write("shortcut", $"desc mismatch: '{desc}' != '{DisplayName}'");
                return false;
            }

            var iconBuilder = new System.Text.StringBuilder(260);
            shellLink.GetIconLocation(iconBuilder, iconBuilder.Capacity, out _);
            var currentIcon = iconBuilder.ToString();
            var expectedIcon = Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico");
            if (!string.Equals(currentIcon, expectedIcon, StringComparison.OrdinalIgnoreCase))
            {
                AppLog.Write("shortcut", $"icon mismatch: '{currentIcon}' != '{expectedIcon}'");
                return false;
            }

            var propertyStore = (IPropertyStore)link;
            var aumidKey = AppUserModelIdKey;
            propertyStore.GetValue(ref aumidKey, out var pv);
            try
            {
                if (pv.vt != 31)
                {
                    AppLog.Write("shortcut", $"AUMID not set (vt={pv.vt})");
                    return false;
                }
                var currentAumid = Marshal.PtrToStringUni(pv.val);
                if (currentAumid != AppUserModelId)
                {
                    AppLog.Write("shortcut", $"AUMID mismatch: '{currentAumid}' != '{AppUserModelId}'");
                    return false;
                }
                return true;
            }
            finally
            {
                pv.Clear();
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("shortcut", $"validate error: {ex.Message}");
            return false;
        }
        finally
        {
            if (link != null) Marshal.ReleaseComObject(link);
        }
    }

    private static void CreateShortcut(string shortcutPath, string exePath, string iconPath)
    {
        var shellLink = (IShellLinkW)new ShellLink();
        try
        {
            shellLink.SetPath(exePath);
            shellLink.SetDescription(DisplayName);
            shellLink.SetWorkingDirectory(Path.GetDirectoryName(exePath) ?? "");

            if (File.Exists(iconPath))
            {
                shellLink.SetIconLocation(iconPath, 0);
            }

            var persistFile = (IPersistFile)shellLink;
            persistFile.Save(shortcutPath, true);

            var hr = RawSetValueOnMta(shellLink, AppUserModelId);
            Console.Error.WriteLine($"[shortcut] raw SetValue: 0x{hr:X8}");

            persistFile.Save(shortcutPath, true);
            Console.Error.WriteLine($"[shortcut] created with AUMID");
        }
        finally
        {
            Marshal.ReleaseComObject(shellLink);
        }
    }
}
