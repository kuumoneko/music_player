using System.Runtime.InteropServices;
using Avalonia.Controls;

namespace KuumoApp.Services;

public sealed class TrayService : IDisposable
{
    private readonly Window _window;
    private readonly WindowService _windowService;
    private IntPtr _trayIcon;
    private IntPtr _oldWndProc;
    private bool _disposed;

    private const int WM_USER = 0x8000;
    private const int WM_COMMAND = 0x0111;
    private const int WM_NULL = 0x0000;
    private const int NIM_ADD = 0x00000000;
    private const int NIM_DELETE = 0x00000002;
    private const int NIF_MESSAGE = 0x00000001;
    private const int NIF_ICON = 0x00000002;
    private const int NIF_TIP = 0x00000004;
    private const int IMAGE_ICON = 1;
    private const int LR_LOADFROMFILE = 0x0010;
    private const int IDI_APPLICATION = 32512;
    private const int GWLP_WNDPROC = -4;
    private const int TPM_RIGHTBUTTON = 0x0002;
    private const int TPM_RETURNCMD = 0x0100;
    private const int WM_LBUTTONUP = 0x0202;
    private const int WM_RBUTTONUP = 0x0205;
    private const int WM_LBUTTONDBLCLK = 0x0203;
    private const int ID_SHOW_HIDE = 1001;
    private const int ID_QUIT = 1002;

    private const int TRAY_CALLBACK = WM_USER + 1;

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NOTIFYICONDATA
    {
        public int cbSize;
        public IntPtr hWnd;
        public int uID;
        public int uFlags;
        public int uCallbackMessage;
        public IntPtr hIcon;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string szTip;
    }

    private delegate IntPtr WndProcDelegate(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern bool Shell_NotifyIcon(int dwMessage, ref NOTIFYICONDATA lpData);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr LoadImage(IntPtr hInst, string name, uint type, int cx, int cy, uint fuLoad);

    [DllImport("user32.dll")]
    private static extern IntPtr LoadIcon(IntPtr hInstance, IntPtr lpIconName);

    [DllImport("user32.dll")]
    private static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll")]
    private static extern IntPtr CallWindowProc(IntPtr lpPrevWndFunc, IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool DestroyIcon(IntPtr hIcon);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr CreatePopupMenu();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool AppendMenu(IntPtr hMenu, int uFlags, IntPtr uIDNewItem, string? lpNewItem);

    [DllImport("user32.dll")]
    private static extern bool TrackPopupMenu(IntPtr hMenu, int uFlags, int x, int y, int nReserved, IntPtr hWnd, IntPtr prcRect);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    private static extern bool DestroyMenu(IntPtr hMenu);

    private WndProcDelegate? _wndProcDelegate;

    public TrayService(Window window, WindowService windowService)
    {
        _window = window;
        _windowService = windowService;
        CreateTrayIcon();
    }

    private void CreateTrayIcon()
    {
        try
        {
            var hWnd = _window.TryGetPlatformHandle()?.Handle ?? IntPtr.Zero;
            if (hWnd == IntPtr.Zero)
            {
                AppLog.Write("tray", "no window handle available");
                return;
            }

            var hIcon = LoadCustomIcon();
            if (hIcon == IntPtr.Zero)
            {
                hIcon = LoadIcon(IntPtr.Zero, (IntPtr)IDI_APPLICATION);
            }

            var nid = new NOTIFYICONDATA
            {
                cbSize = Marshal.SizeOf<NOTIFYICONDATA>(),
                hWnd = hWnd,
                uID = 1,
                uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP,
                uCallbackMessage = TRAY_CALLBACK,
                hIcon = hIcon,
                szTip = "Kuumo Avalonia App",
            };

            Shell_NotifyIcon(NIM_ADD, ref nid);
            _trayIcon = hWnd;

            _wndProcDelegate = WndProc;
            _oldWndProc = SetWindowLongPtr(hWnd, GWLP_WNDPROC,
                Marshal.GetFunctionPointerForDelegate(_wndProcDelegate));

            AppLog.Write("tray", "created with custom icon");
        }
        catch (Exception ex)
        {
            AppLog.Write("tray", $"create failed: {ex.Message}");
        }
    }

    private static IntPtr LoadCustomIcon()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico");
        if (File.Exists(path))
        {
            var hIcon = LoadImage(IntPtr.Zero, path, IMAGE_ICON, 0, 0, LR_LOADFROMFILE);
            if (hIcon != IntPtr.Zero)
            {
                return hIcon;
            }
            AppLog.Write("tray", $"LoadImage failed for {path}, fallback to default");
        }
        else
        {
            AppLog.Write("tray", $"icon not found at {path}");
        }
        return IntPtr.Zero;
    }

    private IntPtr WndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        if (msg == TRAY_CALLBACK)
        {
            var loWord = (int)(lParam.ToInt64() & 0xFFFF);
            if (loWord == WM_LBUTTONUP || loWord == WM_LBUTTONDBLCLK)
            {
                ToggleWindow();
                return IntPtr.Zero;
            }
            if (loWord == WM_RBUTTONUP)
            {
                ShowContextMenu(hWnd);
                return IntPtr.Zero;
            }
        }
        if (msg == WM_COMMAND)
        {
            var id = wParam.ToInt32() & 0xFFFF;
            if (id == ID_SHOW_HIDE)
            {
                ToggleWindow();
                return IntPtr.Zero;
            }
            if (id == ID_QUIT)
            {
                App.ShutdownApp();
                return IntPtr.Zero;
            }
        }
        return CallWindowProc(_oldWndProc, hWnd, msg, wParam, lParam);
    }

    private void ShowContextMenu(IntPtr hWnd)
    {
        GetCursorPos(out var pt);
        var menu = CreatePopupMenu();
        AppendMenu(menu, 0, (IntPtr)ID_SHOW_HIDE, "Show / Hide window");
        AppendMenu(menu, 0x00000800, IntPtr.Zero, (string?)null); // MF_SEPARATOR
        AppendMenu(menu, 0, (IntPtr)ID_QUIT, "Quit");
        SetForegroundWindow(hWnd);
        TrackPopupMenu(menu, TPM_RIGHTBUTTON, pt.X, pt.Y, 0, hWnd, IntPtr.Zero);
        PostMessage(hWnd, WM_NULL, IntPtr.Zero, IntPtr.Zero);
        DestroyMenu(menu);
    }

    public void ToggleWindow()
    {
        if (_windowService.IsWindowVisible)
        {
            _windowService.HideWindow();
        }
        else
        {
            _windowService.Activate();
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        if (_trayIcon != IntPtr.Zero)
        {
            if (_oldWndProc != IntPtr.Zero)
            {
                SetWindowLongPtr(_trayIcon, GWLP_WNDPROC, _oldWndProc);
                _oldWndProc = IntPtr.Zero;
            }
            var nid = new NOTIFYICONDATA
            {
                cbSize = Marshal.SizeOf<NOTIFYICONDATA>(),
                hWnd = _trayIcon,
                uID = 1,
            };
            Shell_NotifyIcon(NIM_DELETE, ref nid);
            _trayIcon = IntPtr.Zero;
        }
    }
}