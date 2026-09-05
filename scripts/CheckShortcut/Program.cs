using System;
using System.IO;
using System.Runtime.InteropServices;

// Usage:
//   CheckShortcut              Create shortcut with WinUI dev defaults
//   CheckShortcut write [path] Create shortcut (optional custom path)
//   CheckShortcut read  [path] Read AUMID from shortcut
//   CheckShortcut <exePath> <iconPath>  Create shortcut with explicit exe/icon paths

var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
var winuiBin = Path.Combine(root, "app-winui", "KuumoApp", "bin", "x64", "Debug", "net10.0-windows10.0.22621.0", "win-x64");
var defaultExe = Path.Combine(winuiBin, "KuumoApp.exe");
var defaultIcon = Path.Combine(winuiBin, "Assets", "AppIcon.ico");

string mode;
string shortcutPath;
string exePath = defaultExe;
string iconPath = defaultIcon;
string aumid = "kuumo.app";

if (args.Length >= 2 && args[0] == "read")
{
    mode = "read";
    shortcutPath = args[1];
}
else if (args.Length >= 2 && args[0] == "write")
{
    mode = "write";
    shortcutPath = args.Length > 1 ? args[1] : Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        @"Microsoft\Windows\Start Menu\Programs\Kuumo App.lnk");
    exePath = args.Length > 2 ? args[2] : defaultExe;
    iconPath = args.Length > 3 ? args[3] : defaultIcon;
}
else if (args.Length >= 2)
{
    mode = "write";
    exePath = args[0];
    iconPath = args[1];
    shortcutPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        @"Microsoft\Windows\Start Menu\Programs\Kuumo App.lnk");
}
else
{
    mode = "write";
    shortcutPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        @"Microsoft\Windows\Start Menu\Programs\Kuumo App.lnk");
    exePath = defaultExe;
    iconPath = defaultIcon;
}

var link = (IShellLinkW)new CShellLink();
var pf = (IPersistFile)link;

if (mode == "write")
{
    Console.WriteLine($"Creating: {shortcutPath}");
    Console.WriteLine($"Exe: {exePath}");
    Console.WriteLine($"Icon: {iconPath}");
    Console.WriteLine($"AUMID: {aumid}");
    if (File.Exists(shortcutPath)) File.Delete(shortcutPath);

    link.SetPath(exePath);
    link.SetDescription("Kuumo App");
    link.SetIconLocation(iconPath, 0);

    pf.Save(shortcutPath, true);
    Console.WriteLine("Shortcut base saved.");
    Marshal.ReleaseComObject(link);

    // Now reopen and set AUMID via raw vtable
    link = (IShellLinkW)new CShellLink();
    pf = (IPersistFile)link;
    pf.Load(shortcutPath, 2); // STGM_READWRITE

    var psPtr = Marshal.GetComInterfaceForObject(link, typeof(IPropertyStore));
    var vtable = Marshal.ReadIntPtr(psPtr);

    // Build PROPVARIANT in unmanaged memory
    var strPtr = Marshal.StringToCoTaskMemUni(aumid);
    var pvPtr = Marshal.AllocHGlobal(16);
    Marshal.WriteInt16(pvPtr, 0, 31); // VT_LPWSTR
    Marshal.WriteIntPtr(pvPtr, 8, strPtr);

    // Build PropertyKey
    var pkPtr = Marshal.AllocHGlobal(20);
    Marshal.StructureToPtr(new PropertyKey { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 }, pkPtr, false);

    // SetValue: slot 6 = IUnknown(3) + GetCount + GetAt + GetValue + SetValue
    // Read the function pointer from the vtable
    var setValueAddr = Marshal.ReadIntPtr(vtable, 6 * IntPtr.Size);
    // Build a delegate
    var setValue = Marshal.GetDelegateForFunctionPointer<SetValueFn>(setValueAddr);
    var hr = setValue(psPtr, pkPtr, pvPtr);
    Console.WriteLine($"SetValue: 0x{hr:X8}");

    // Commit: slot 7
    var commitAddr = Marshal.ReadIntPtr(vtable, 7 * IntPtr.Size);
    var commit = Marshal.GetDelegateForFunctionPointer<CommitFn>(commitAddr);
    hr = commit(psPtr);
    Console.WriteLine($"Commit: 0x{hr:X8}");

    // Save again
    pf.Save(shortcutPath, true);
    Console.WriteLine("Save done.");

    Marshal.FreeCoTaskMem(strPtr);
    Marshal.FreeHGlobal(pvPtr);
    Marshal.FreeHGlobal(pkPtr);
    Marshal.ReleaseComObject(link);
    Console.WriteLine("Done.");
}
else
{
    Console.WriteLine($"Reading: {shortcutPath}");
    pf.Load(shortcutPath, 0);

    // Read via raw vtable too
    var psPtr = Marshal.GetComInterfaceForObject(link, typeof(IPropertyStore));
    var vtable = Marshal.ReadIntPtr(psPtr);

    var pkPtr = Marshal.AllocHGlobal(20);
    Marshal.StructureToPtr(new PropertyKey { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 }, pkPtr, false);

    var pvPtr = Marshal.AllocHGlobal(16);
    Marshal.WriteInt64(pvPtr, 0, 0);
    Marshal.WriteInt64(pvPtr, 8, 0);

    // GetValue: slot 5
    var getValueAddr = Marshal.ReadIntPtr(vtable, 5 * IntPtr.Size);
    var getValue = Marshal.GetDelegateForFunctionPointer<GetValueFn>(getValueAddr);
    var hr = getValue(psPtr, pkPtr, pvPtr);
    Console.WriteLine($"GetValue: 0x{hr:X8}");

    var vt = Marshal.ReadInt16(pvPtr, 0);
    Console.WriteLine($"vt={vt}");
    if (vt == 31)
    {
        var valPtr = Marshal.ReadIntPtr(pvPtr, 8);
        var readAumid = Marshal.PtrToStringUni(valPtr);
        Console.WriteLine($"AUMID: '{readAumid}'");
    }
    else
    {
        Console.WriteLine("AUMID NOT SET");
    }

    Marshal.FreeHGlobal(pkPtr);
    Marshal.FreeHGlobal(pvPtr);
    Marshal.ReleaseComObject(link);
}

return;

[UnmanagedFunctionPointer(System.Runtime.InteropServices.CallingConvention.Winapi)]
delegate int SetValueFn(IntPtr thisPtr, IntPtr key, IntPtr pv);

[UnmanagedFunctionPointer(System.Runtime.InteropServices.CallingConvention.Winapi)]
delegate int GetValueFn(IntPtr thisPtr, IntPtr key, IntPtr pv);

[UnmanagedFunctionPointer(System.Runtime.InteropServices.CallingConvention.Winapi)]
delegate int CommitFn(IntPtr thisPtr);

[ComImport, Guid("000214F9-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellLinkW
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
    void SetShowCmd(int piShowCmd);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszIconPath, int cch, out int piIcon);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
    void Resolve(IntPtr hwnd, int fFlags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
}

[ComImport, Guid("00021401-0000-0000-c000-000000000046")]
class CShellLink { }

[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore { }

[ComImport, Guid("0000010b-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPersistFile
{
    void GetClassID(out Guid pClassID);
    void IsDirty();
    void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, int dwMode);
    void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
    void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
    void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
struct PropertyKey { public Guid fmtid; public uint pid; }
