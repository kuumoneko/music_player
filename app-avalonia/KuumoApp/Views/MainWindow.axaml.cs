using System.Runtime.InteropServices;
using System.Text.Json;
using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using Avalonia.Threading;
using KuumoApp.Models;
using KuumoApp.Services;

using System;

namespace KuumoApp.Views;

public partial class MainWindow : Window
{
    private const string Aumid = "KuumoApp";

    private const int WM_SETICON = 0x0080;
    private const int ICON_SMALL = 0;
    private const int ICON_BIG = 1;
    private const int ICON_SMALL2 = 2;
    private const int IMAGE_ICON = 1;
    private const int LR_LOADFROMFILE = 0x0010;
    private const int GCLP_HICON = -14;
    private const int GCLP_HICONSM = -34;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr LoadImage(IntPtr hInst, string name, uint type, int cx, int cy, uint fuLoad);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", EntryPoint = "SetClassLongPtrW", SetLastError = true)]
    private static extern IntPtr SetClassLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
    private static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid riid, out IntPtr propertyStore);

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

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PropertyKey
    {
        public Guid fmtid;
        public uint pid;
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
            vt = 31; // VT_LPWSTR
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

    private static readonly PropertyKey AppUserModelIdKey = new()
    {
        fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
        pid = 5
    };

    private readonly UiMemoryManager _memory;
    private readonly DispatcherTimer _showFallbackTimer;
    private SmtcService? _smtc;
    private TrayService? _tray;
    private bool _smtcInitialized;
    private int _lastTimeMs;
    private int _lastDurationMs;

    public MainWindow()
    {
        InitializeComponent();

        var rpc = App.Services.Rpc;
        _memory = new UiMemoryManager(this, rpc);

        _showFallbackTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(12),
        };
        _showFallbackTimer.Tick += (_, _) =>
        {
            _showFallbackTimer.Stop();
            if (!IsVisible)
            {
                AppLog.Write("window", "backend not ready in time, showing window");
                Show();
                Activate();
            }
        };

        App.Services.Events.OpenApp += () => Dispatcher.UIThread.Post(() => { Show(); Activate(); });
        App.Services.Events.AppExit += () => Dispatcher.UIThread.Post(() => App.ShutdownApp());
        App.Services.SingleInstanceDetected += () => Dispatcher.UIThread.Post(() => App.ShutdownApp());
        App.Services.Events.MessageReceived += data => AppLog.Write("app", $"showMessage: {data.Title} - {data.Message}");

        App.Services.Events.SmtcUpdated += data =>
        {
            _smtc?.Update(data);
        };
        App.Services.Events.TimeUpdated += data =>
        {
            _lastTimeMs = (int)(data.Time * 1000);
            _smtc?.UpdatePosition(_lastTimeMs, _lastDurationMs);
        };
        App.Services.Events.PlayerStateChanged += data =>
        {
            _lastDurationMs = (int)data.Duration;
            _smtc?.UpdatePosition(_lastTimeMs, (int)data.Duration);
        };

        Activated += (_, _) =>
        {
            if (!_smtcInitialized)
            {
                _smtcInitialized = true;
                var hwnd = TryGetPlatformHandle()?.Handle ?? IntPtr.Zero;
                if (hwnd != IntPtr.Zero)
                {
                    StampAumidOnWindow(hwnd);
                    SetWindowIcons(hwnd);
                }
                _smtc = new SmtcService();
                App.Services.Smtc = _smtc;
                _smtc.Initialize(hwnd);
                if (OperatingSystem.IsWindows() && App.Services.Window is { } ws)
                {
                    _tray = new TrayService(this, ws);
                }
            }
        };
        Closed += (_, _) =>
        {
            _showFallbackTimer.Stop();
            _smtc?.Dispose();
            _tray?.Dispose();
            AppLog.Stop();
        };

        if (App.Services.Window is { } ws)
        {
            ws.WindowHidden += () =>
            {
                _smtc?.Pause();
                App.Services.Theme.SetBackground(true);
                _memory.OnWindowHidden();
                ShellPage.Instance?.DetachContent();
                ShellPage.Instance?.DetachNavContent();
            };
            ws.WindowShown += () =>
            {
                ShellPage.Instance?.RestoreNavContent();
                ShellPage.Instance?.RestoreContent();
                _smtc?.Unpause();
                App.Services.Theme.SetBackground(false);
                _memory.OnWindowShown();
            };
        }

        App.Services.Rpc.Connected += OnRpcConnected;

        Shell.SetStatus("starting backend...");
        _showFallbackTimer.Start();
    }

    public void PauseRendering() => StopRendering();
    public void ResumeRendering() => StartRendering();

    private static void SetWindowIcons(IntPtr hwnd)
    {
        var icoPath = Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico");
        if (!File.Exists(icoPath)) return;

        var hIcon = LoadImage(IntPtr.Zero, icoPath, IMAGE_ICON, 256, 256, LR_LOADFROMFILE);
        if (hIcon == IntPtr.Zero) return;

        SetClassLongPtr(hwnd, GCLP_HICON, hIcon);
        SetClassLongPtr(hwnd, GCLP_HICONSM, hIcon);

        SendMessage(hwnd, WM_SETICON, (IntPtr)ICON_SMALL, hIcon);
        SendMessage(hwnd, WM_SETICON, (IntPtr)ICON_BIG, hIcon);
        SendMessage(hwnd, WM_SETICON, (IntPtr)ICON_SMALL2, hIcon);
    }

    private static void StampAumidOnWindow(IntPtr hwnd)
    {
        try
        {
            var iid = typeof(IPropertyStore).GUID;
            var hr = SHGetPropertyStoreForWindow(hwnd, ref iid, out var psPtr);
            if (hr != 0 || psPtr == IntPtr.Zero) return;
            var propertyStore = (IPropertyStore)Marshal.GetObjectForIUnknown(psPtr);
            Marshal.Release(psPtr);
            var pv = new PropVariant();
            pv.SetString(Aumid);
            var key = AppUserModelIdKey;
            try
            {
                propertyStore.SetValue(ref key, ref pv);
                propertyStore.Commit();
            }
            finally
            {
                pv.Clear();
                Marshal.ReleaseComObject(propertyStore);
            }
        }
        catch
        {
            // Best-effort
        }
    }

    private async void OnRpcConnected()
    {
        AppLog.Write("main", "rpc connected");
        try
        {
            var playing = await App.Services.Api.GetPlayingDataAsync();
            AppLog.Write("main", $"playing={JsonSerializer.Serialize(playing)}");
            await App.Services.Window!.InitializeAsync();
            _showFallbackTimer.Stop();
            Dispatcher.UIThread.Post(() => Shell.SetStatus("connected"));
        }
        catch (Exception ex)
        {
            AppLog.Write("main", $"startup failed: {ex.ToString()}");
        }
    }
}
