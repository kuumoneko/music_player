using KuumoApp.Models;
using Microsoft.UI.Xaml;
using System.IO;
using System.Runtime.InteropServices;
using Windows.Media;
using Windows.Storage.Streams;
using WinRT.Interop;

namespace KuumoApp.Services;

public sealed class SmtcService : IDisposable
{
    private readonly Window _window;
    private SystemMediaTransportControls? _smtc;
    private SystemMediaTransportControlsDisplayUpdater? _updater;
    private SystemMediaTransportControlsTimelineProperties _timeline = new();
    private InMemoryRandomAccessStream? _thumbnailStream;
    private RandomAccessStreamReference? _thumbnailReference;
    private int _thumbnailVersion;
    private bool _disposed;
    private bool _isPaused;

    public SmtcService(Window window)
    {
        _window = window;
    }

    public bool IsPaused
    {
        get => _isPaused;
        set => _isPaused = value;
    }

    public void Initialize()
    {
        _smtc = GetForWindow();
        if (_smtc is not null)
        {
            AppLog.Write("smtc", "initialized via interop GetForWindow");
        }
        else
        {
            AppLog.Write("smtc", "init failed: no instance available");
            return;
        }
        try
        {
            _updater = _smtc.DisplayUpdater;
            _updater.Type = MediaPlaybackType.Music;
            _updater.AppMediaId = Environment.GetEnvironmentVariable("KUUMO_DEV") == "1" ? "kuumo.app.dev" : "kuumo.app";
            _ = LoadDefaultIconAsync();
            _smtc.IsEnabled = true;
            _smtc.IsPlayEnabled = true;
            _smtc.IsPauseEnabled = true;
            _smtc.IsNextEnabled = true;
            _smtc.IsPreviousEnabled = true;
            _smtc.PlaybackStatus = MediaPlaybackStatus.Closed;
            _smtc.ButtonPressed += OnButtonPressed;
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"init failed: {ex.Message}");
            _smtc = null;
            _updater = null;
        }
    }

    private SystemMediaTransportControls? GetForWindow()
    {
        try
        {
            var hwnd = WindowNative.GetWindowHandle(_window);
            var hstr = CreateHString("Windows.Media.SystemMediaTransportControls");
            try
            {
                var iidUnknown = new Guid("00000000-0000-0000-c000-000000000046");
                var hr = RoGetActivationFactory(hstr, ref iidUnknown, out var factory);
                if (hr != 0)
                {
                    AppLog.Write("smtc", $"RoGetActivationFactory failed: 0x{hr:X8}");
                    return null;
                }
                var interop = (ISystemMediaTransportControlsInterop)Marshal.GetObjectForIUnknown(factory);
                var iidSmtc = new Guid("99fa3ff4-1742-42a6-902e-087d41f965ec");
                hr = interop.GetForWindow(hwnd, ref iidSmtc, out var smtcPtr);
                if (hr != 0)
                {
                    AppLog.Write("smtc", $"GetForWindow failed: 0x{hr:X8}");
                    return null;
                }
                return WinRT.MarshalInterface<SystemMediaTransportControls>.FromAbi(smtcPtr);
            }
            finally
            {
                WindowsDeleteString(hstr);
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"interop failed: {ex.Message}");
            return null;
        }
    }

    [DllImport("combase.dll", PreserveSig = true)]
    private static extern int RoGetActivationFactory(IntPtr activatableClassId, ref Guid iid, out IntPtr factory);

    [DllImport("combase.dll", PreserveSig = true)]
    private static extern int WindowsCreateString([MarshalAs(UnmanagedType.LPWStr)] string sourceString, int length, out IntPtr hstring);

    [DllImport("combase.dll")]
    private static extern void WindowsDeleteString(IntPtr hstring);

    private static IntPtr CreateHString(string value)
    {
        var hr = WindowsCreateString(value, value.Length, out var hstr);
        if (hr != 0)
        {
            throw new InvalidOperationException($"WindowsCreateString failed: 0x{hr:X8}");
        }
        return hstr;
    }

    [ComImport]
    [Guid("ddb0472d-c911-4a1f-86d9-dc3d71a95f5a")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISystemMediaTransportControlsInterop
    {
        [PreserveSig]
        int GetIids(out uint count, out IntPtr iids);

        [PreserveSig]
        int GetRuntimeClassName(out IntPtr className);

        [PreserveSig]
        int GetTrustLevel(out int trustLevel);

        [PreserveSig]
        int GetForWindow(IntPtr appWindow, ref Guid riid, out IntPtr systemMediaTransportControls);
    }

    public void Update(SmtcUpdateDto data)
    {
        if (_smtc is null || _updater is null)
        {
            return;
        }
        try
        {
            if (string.IsNullOrEmpty(data.Title))
            {
                _smtc.PlaybackStatus = MediaPlaybackStatus.Closed;
                return;
            }
            _updater.MusicProperties.Title = data.Title;
            _updater.MusicProperties.Artist = data.Artist ?? "";
            _smtc.PlaybackStatus = data.IsPlaying ? MediaPlaybackStatus.Playing : MediaPlaybackStatus.Paused;
            _updater.Update();

            // Thumbnails are part of the SMTC contract and must keep updating while the
            // window is hidden. Rapid track changes bump the version so only the newest
            // load is allowed to publish, otherwise a slow older download can overwrite
            // the current track's artwork.
            var version = ++_thumbnailVersion;
            _ = LoadThumbnailAsync(data.Thumbnail, version);
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"update failed: {ex.Message}");
        }
    }

    public void UpdatePosition(int timeMs, int durationMs)
    {
        if (_smtc is null)
        {
            return;
        }
        try
        {
            _timeline.Position = TimeSpan.FromMilliseconds(Math.Max(0, timeMs));
            _timeline.EndTime = TimeSpan.FromMilliseconds(Math.Max(0, durationMs));
            _timeline.MinSeekTime = TimeSpan.Zero;
            _timeline.MaxSeekTime = TimeSpan.FromMilliseconds(Math.Max(0, durationMs));
            _smtc.UpdateTimelineProperties(_timeline);
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"position failed: {ex.Message}");
        }
    }

    public void Clear()
    {
        if (_smtc is null)
        {
            return;
        }
        try
        {
            _smtc.PlaybackStatus = MediaPlaybackStatus.Closed;
            _thumbnailVersion++;
            _updater?.ClearAll();
            _thumbnailStream?.Dispose();
            _thumbnailStream = null;
            _thumbnailReference = null;
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"clear failed: {ex.Message}");
        }
    }

    private async Task LoadDefaultIconAsync()
    {
        if (_updater is null)
        {
            return;
        }
        try
        {
            var iconPath = Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico");
            if (!File.Exists(iconPath))
            {
                return;
            }
            var version = _thumbnailVersion;
            var bytes = await File.ReadAllBytesAsync(iconPath);
            var stream = new InMemoryRandomAccessStream();
            using (var writer = new DataWriter(stream))
            {
                writer.WriteBytes(bytes);
                await writer.StoreAsync();
                writer.DetachStream();
            }
            stream.Seek(0);
            if (version != _thumbnailVersion)
            {
                stream.Dispose();
                return;
            }
            ApplyThumbnail(RandomAccessStreamReference.CreateFromStream(stream), stream);
            AppLog.Write("smtc", "default app icon loaded");
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"default icon failed: {ex.Message}");
        }
    }

    private async Task LoadThumbnailAsync(string? url, int version)
    {
        if (_updater is null)
        {
            return;
        }
        try
        {
            if (string.IsNullOrEmpty(url))
            {
                if (version == _thumbnailVersion)
                {
                    ApplyThumbnail(null, null);
                }
                return;
            }

            if (Uri.TryCreate(url, UriKind.Absolute, out var webUri) &&
                (webUri.Scheme == Uri.UriSchemeHttp || webUri.Scheme == Uri.UriSchemeHttps))
            {
                if (version != _thumbnailVersion)
                {
                    return;
                }
                ApplyThumbnail(RandomAccessStreamReference.CreateFromUri(webUri), null);
                AppLog.Write("smtc", $"thumbnail set via URI: {url}");
                return;
            }

            var dataUri = await App.Services.Api.GetImageDataUriAsync(url);
            if (version != _thumbnailVersion)
            {
                return;
            }
            if (string.IsNullOrEmpty(dataUri))
            {
                ApplyThumbnail(null, null);
                return;
            }
            var comma = dataUri.IndexOf(',');
            var bytes = Convert.FromBase64String(dataUri[(comma + 1)..]);
            bytes = await ThumbTrim.TrimAsync(bytes) ?? bytes;
            if (version != _thumbnailVersion)
            {
                return;
            }
            var stream = new InMemoryRandomAccessStream();
            using (var writer = new DataWriter(stream))
            {
                writer.WriteBytes(bytes);
                await writer.StoreAsync();
                writer.DetachStream();
            }
            stream.Seek(0);
            ApplyThumbnail(RandomAccessStreamReference.CreateFromStream(stream), stream);
            AppLog.Write("smtc", $"thumbnail set: {bytes.Length} bytes from {url}");
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"thumbnail failed: {ex.Message}");
            if (version == _thumbnailVersion)
            {
                ApplyThumbnail(null, null);
            }
        }
    }

    /// <summary>
    /// Publishes artwork to SMTC and only then releases the stream it replaces, so the
    /// displayed image is never disposed while the shell may still be reading it.
    /// </summary>
    private void ApplyThumbnail(RandomAccessStreamReference? reference, InMemoryRandomAccessStream? stream)
    {
        if (_updater is null)
        {
            stream?.Dispose();
            return;
        }
        var previous = _thumbnailStream;
        _thumbnailStream = stream;
        _thumbnailReference = reference;
        _updater.Thumbnail = reference;
        _updater.Update();
        if (!ReferenceEquals(previous, stream))
        {
            previous?.Dispose();
        }
    }

    private async void OnButtonPressed(SystemMediaTransportControls sender, SystemMediaTransportControlsButtonPressedEventArgs args)
    {
        AppLog.Write("smtc", $"button pressed: {args.Button}");
        try
        {
            switch (args.Button)
            {
                case SystemMediaTransportControlsButton.Play:
                case SystemMediaTransportControlsButton.Pause:
                    await App.Services.Api.TogglePlayPauseAsync();
                    break;
                case SystemMediaTransportControlsButton.Next:
                    await App.Services.Api.NextAsync();
                    break;
                case SystemMediaTransportControlsButton.Previous:
                    await App.Services.Api.PreviousAsync();
                    break;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("smtc", $"button {args.Button} failed: {ex.Message}");
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;
        if (_smtc is not null)
        {
            _smtc.ButtonPressed -= OnButtonPressed;
            _smtc.IsEnabled = false;
            _smtc = null;
        }
        _updater = null;
        _thumbnailStream?.Dispose();
        _thumbnailStream = null;
        _thumbnailReference = null;
    }
}
