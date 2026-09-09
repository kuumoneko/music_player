using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using KuumoApp.Models;
using KuumoApp.Services;
using KuumoApp.Views;

namespace KuumoApp.Controls;

public partial class PlayerBar : UserControl
{
    private bool _isPlaying;
    private bool _isLive;
    private bool _seekDragging;
    private bool _volumeDragging;
    private bool _suppressSeekValue;
    private double _pendingSeekSeconds = -1;
    private int _shuffle;
    private int _repeat;
    private int _lastVolume = 50;
    private string _sleepMode = "nosleep";
    private string _nextfrom = "";
    private string _resolvedNextfrom = "";
    private string _currentSource = "";
    private string _currentId = "";
    private string _currentArtistId = "";
    private Avalonia.Threading.DispatcherTimer? _seekCommitTimer;

    public PlayerBar()
    {
        InitializeComponent();
        _seekCommitTimer = new Avalonia.Threading.DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(250)
        };
        _seekCommitTimer.Tick += (_, _) =>
        {
            _seekCommitTimer.Stop();
            if (_pendingSeekSeconds >= 0)
            {
                var target = _pendingSeekSeconds;
                _pendingSeekSeconds = -1;
                ApplySeekTo(target);
            }
        };
        App.Services.Events.TimeUpdated += data => Avalonia.Threading.Dispatcher.UIThread.Post(() =>
        {
            if (App.Services.Window?.IsWindowVisible == true) SetTime(data);
        });
        App.Services.Events.PlayerStateChanged += data => Avalonia.Threading.Dispatcher.UIThread.Post(() =>
        {
            if (App.Services.Window?.IsWindowVisible == true) SetPlayerState(data);
        });
        App.Services.Events.CurrentTrackChanged += data => Avalonia.Threading.Dispatcher.UIThread.Post(() =>
        {
            if (App.Services.Window?.IsWindowVisible == true) SetTrack(data);
        });
        App.Services.Events.SettingsChanged += data => Avalonia.Threading.Dispatcher.UIThread.Post(() => SetSettings(data));
        App.Services.Events.QueueChanged += data => Avalonia.Threading.Dispatcher.UIThread.Post(() =>
        {
            if (App.Services.Window?.IsWindowVisible == true) SetNextFrom(data.Nextfrom);
        });
        App.Services.Rpc.Connected += () => Avalonia.Threading.Dispatcher.UIThread.Post(async () => await LoadInitialStateAsync());
        SliderExt.HookThumbDrag(SeekSlider, OnSeekDragStarted, OnSeekDragCompleted);
        SliderExt.HookThumbDrag(VolumeSlider, OnVolumeDragStarted, OnVolumeDragCompleted);
    }

    private async Task LoadInitialStateAsync()
    {
        try
        {
            var playing = await App.Services.Api.GetPlayingDataAsync();
            if (playing is not null)
            {
                _isPlaying = playing.IsPlaying;
                _shuffle = playing.Shuffle;
                _repeat = playing.Repeat;
                UpdatePlayPauseIcon();
                UpdateStateIcons();
                SetDuration((int)playing.Current.Duration);
                SetTime(new TimeUpdateDto(playing.Current.Time, playing.IsPlaying));
            }
            var current = await App.Services.Api.GetCurrentPlayingAsync();
            if (current is not null)
            {
                SetTrack(current);
            }
            var volume = await App.Services.Api.GetUserDataAsync<int>("volume");
            VolumeSlider.Value = volume;
            if (volume > 0)
            {
                _lastVolume = volume;
            }
            var nextfrom = await App.Services.Api.GetUserDataAsync<string>("nextfrom");
            if (!string.IsNullOrEmpty(nextfrom))
            {
                SetNextFrom(nextfrom);
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"initial load failed: {ex.GetType().Name}: {ex}");
        }
    }

    public void SetTrack(CurrentTrackChangedDto track)
    {
        _currentSource = track.Source ?? "";
        _currentId = track.Id ?? "";
        _currentArtistId = track.ArtistId ?? "";
        TrackTitle.Text = string.IsNullOrEmpty(track.Title) ? "Nothing playing" : track.Title;
        TrackArtist.Text = track.Artist ?? "";
        _ = LoadThumbnailAsync(track.Thumbnail);
    }

    private async Task LoadThumbnailAsync(string url)
    {
        try
        {
            await ImageHelper.LoadAsync(Thumb, url);
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"thumbnail failed: {ex.GetType().Name}: {ex}");
        }
    }

    public void SetTime(TimeUpdateDto data)
    {
        if (_seekDragging)
        {
            return;
        }
        _suppressSeekValue = true;
        SeekSlider.Value = Math.Min(data.Time, SeekSlider.Maximum);
        _suppressSeekValue = false;
        CurrentTime.Text = FormatTime((int)(data.Time * 1000));
    }

    public void SetPlayerState(PlayerStateChangeDto data)
    {
        _isPlaying = data.IsPlaying;
        UpdatePlayPauseIcon();
        SetDuration((int)data.Duration);
        if (!_isLive)
        {
            LiveBadge.IsVisible = data.IsLived;
        }
    }

    private void SetDuration(int durationMs)
    {
        _isLive = durationMs <= 0;
        SeekSlider.IsEnabled = !_isLive;
        _suppressSeekValue = true;
        SeekSlider.Maximum = Math.Max(1, durationMs / 1000.0);
        _suppressSeekValue = false;
        TotalTime.Text = _isLive ? "--:--" : FormatTime(durationMs);
    }

    public void SetSettings(SettingsChangedDto data)
    {
        _shuffle = data.Shuffle;
        _repeat = data.Repeat;
        UpdateStateIcons();
        if (!_volumeDragging)
        {
            VolumeSlider.Value = data.Volume;
        }
        UpdateVolumeIcon();
    }

    private void UpdateStateIcons()
    {
        var accent = AccentBrush();
        var idle = IdleBrush();
        ShuffleIcon.Foreground = _shuffle != 0 ? accent : idle;
        RepeatIcon.Text = _repeat == 1 ? "\uE8ED" : "\uE8EE";
        RepeatIcon.Foreground = _repeat != 0 ? accent : idle;
    }

    private void UpdateVolumeIcon()
    {
        VolumeIcon.Text = VolumeSlider.Value <= 0 ? "\uE74F" : "\uE767";
    }

    private static Brush AccentBrush()
    {
        if (Application.Current?.TryFindResource("AppAccentBrush", null, out var v1) == true && v1 is Brush brush)
        {
            return brush;
        }
        if (Application.Current?.TryFindResource("AccentFillColorDefaultBrush", null, out var v2) == true && v2 is Brush themeBrush)
        {
            return themeBrush;
        }
        return new SolidColorBrush(Colors.DodgerBlue);
    }

    private static Brush IdleBrush()
    {
        if (Application.Current?.TryFindResource("TextFillColorSecondaryBrush", null, out var v) == true && v is Brush brush)
        {
            return brush;
        }
        return new SolidColorBrush(Colors.Gray);
    }

    public void ToggleShuffle()
    {
        _shuffle = _shuffle != 0 ? 0 : 1;
        UpdateStateIcons();
        _ = SetShuffleAsync(_shuffle);
    }

    public void CycleRepeat()
    {
        _repeat = (_repeat + 1) % 3;
        UpdateStateIcons();
        _ = SetRepeatAsync(_repeat);
    }

    public void ToggleMute()
    {
        if (VolumeSlider.Value > 0)
        {
            _lastVolume = (int)VolumeSlider.Value;
            VolumeSlider.Value = 0;
        }
        else
        {
            VolumeSlider.Value = Math.Max(1, _lastVolume);
        }
        UpdateVolumeIcon();
        ApplyVolume();
    }

    public void StepVolume(int delta)
    {
        VolumeSlider.Value = Math.Clamp(VolumeSlider.Value + delta, 0, 100);
        UpdateVolumeIcon();
        ApplyVolume();
    }

    private async void OnShuffleClick(object? sender, RoutedEventArgs e)
    {
        ToggleShuffle();
    }

    private async void OnRepeatClick(object? sender, RoutedEventArgs e)
    {
        CycleRepeat();
    }

    private void OnMuteClick(object? sender, RoutedEventArgs e)
    {
        ToggleMute();
    }

    private async Task SetShuffleAsync(int value)
    {
        try
        {
            await App.Services.Api.SetUserDataAsync("shuffle", value);
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"shuffle failed: {ex.Message}");
        }
    }

    private async Task SetRepeatAsync(int value)
    {
        try
        {
            await App.Services.Api.SetUserDataAsync("repeat", value);
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"repeat failed: {ex.Message}");
        }
    }

    private async void OnSleepButtonClick(object? sender, RoutedEventArgs e)
    {
        var menu = new MenuFlyout();

        void AddItem(string text, string mode)
        {
            var item = new MenuItem { Header = text, Tag = mode };
            item.Click += async (_, _) =>
            {
                try
                {
                    await App.Services.Api.SetSleepAsync(mode);
                    _sleepMode = mode;
                    UpdateSleepUi();
                }
                catch (Exception ex)
                {
                    AppLog.Write("playerbar", $"sleep failed: {ex.Message}");
                }
            };
            menu.Items.Add(item);
        }

        AddItem("Off", "nosleep");
        menu.Items.Add(new Separator());
        AddItem("5 minutes", "after 5 minutes");
        AddItem("10 minutes", "after 10 minutes");
        AddItem("15 minutes", "after 15 minutes");
        AddItem("30 minutes", "after 30 minutes");
        AddItem("45 minutes", "after 45 minutes");
        AddItem("1 hour", "after 1 hour");
        menu.Items.Add(new Separator());
        AddItem("End of track", "end of this track");

        menu.Placement = PlacementMode.BottomEdgeAlignedLeft;
        menu.ShowAt(SleepButton);
    }

    private void UpdateSleepUi()
    {
        var active = _sleepMode != SleepMode.No;
        SleepIcon.Foreground = active ? AccentBrush() : IdleBrush();
        var label = SleepLabel(_sleepMode);
        if (active && label.Length > 0)
        {
            SleepModeText.Text = label;
            SleepModeText.IsVisible = true;
        }
        else
        {
            SleepModeText.IsVisible = false;
        }
    }

    private static string SleepLabel(string mode) => mode switch
    {
        SleepMode.Five => "5m",
        SleepMode.Ten => "10m",
        SleepMode.Fifteen => "15m",
        SleepMode.Thirty => "30m",
        SleepMode.FortyFive => "45m",
        SleepMode.Hour => "1h",
        SleepMode.EndOfTrack => "End",
        _ => "",
    };

    private async void SetNextFrom(string nextfrom)
    {
        _nextfrom = nextfrom;
        if (nextfrom == _resolvedNextfrom)
        {
            return;
        }
        if (string.IsNullOrEmpty(nextfrom))
        {
            _resolvedNextfrom = "";
            TrackFrom.IsVisible = false;
            return;
        }
        var parts = nextfrom.Split(':');
        if (parts.Length < 3)
        {
            _resolvedNextfrom = nextfrom;
            TrackFrom.IsVisible = false;
            return;
        }
        var source = parts[0];
        var type = parts[1];
        var id = parts[2];
        if (type == MusicType.Track || type == MusicType.Local)
        {
            _resolvedNextfrom = nextfrom;
            TrackFrom.IsVisible = false;
            return;
        }
        try
        {
            var data = await App.Services.Api.GetMusicDataAsync(source, type, id);
            if (data is JsonElement el && el.ValueKind == JsonValueKind.Object)
            {
                var name = el.TryGetProperty("name", out var n) ? n.GetString() : null;
                if (string.IsNullOrEmpty(name))
                {
                    _resolvedNextfrom = nextfrom;
                    TrackFrom.IsVisible = false;
                    return;
                }
                _resolvedNextfrom = nextfrom;
                TrackFrom.Text = $"From: {name}";
                TrackFrom.IsVisible = true;
            }
            else
            {
                _resolvedNextfrom = nextfrom;
                TrackFrom.IsVisible = false;
            }
        }
        catch (Exception ex)
        {
            _resolvedNextfrom = nextfrom;
            AppLog.Write("playerbar", $"nextfrom resolve failed: {ex.Message}");
            TrackFrom.IsVisible = false;
        }
    }

    private void OnTrackFromPressed(object? sender, PointerPressedEventArgs e)
    {
        var parts = _nextfrom.Split(':');
        if (parts.Length >= 3)
        {
            ShellPage.NavigateDetail(parts[0], parts[1], parts[2]);
        }
    }

    private void OnTrackTitlePressed(object? sender, PointerPressedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentId))
        {
            ShellPage.NavigateDetail(_currentSource, MusicType.Track, _currentId);
        }
    }

    private void OnTrackArtistPressed(object? sender, PointerPressedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentArtistId))
        {
            ShellPage.NavigateDetail(_currentSource, MusicType.Artist, _currentArtistId);
        }
    }

    private void UpdatePlayPauseIcon()
    {
        PlayPauseIcon.Text = _isPlaying ? "\uE769" : "\uE768";
    }

    private static string FormatTime(int ms)
    {
        var total = Math.Max(0, ms / 1000);
        return $"{total / 60}:{total % 60:00}";
    }

    public void TogglePlayPause()
    {
        _isPlaying = !_isPlaying;
        UpdatePlayPauseIcon();
        _ = TogglePlayPauseAsync();
    }

    private async void OnPlayPauseClick(object? sender, RoutedEventArgs e)
    {
        TogglePlayPause();
    }

    private async Task TogglePlayPauseAsync()
    {
        try
        {
            await App.Services.Api.TogglePlayPauseAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"togglePlayPause failed: {ex.Message}");
        }
    }

    public Task PreviousAsync() => PreviousTrackAsync();

    private async void OnPrevClick(object? sender, RoutedEventArgs e)
    {
        await PreviousTrackAsync();
    }

    private async Task PreviousTrackAsync()
    {
        try
        {
            await App.Services.Api.PreviousAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"previous failed: {ex.Message}");
        }
    }

    public Task NextAsync() => NextTrackAsync();

    private async void OnNextClick(object? sender, RoutedEventArgs e)
    {
        await NextTrackAsync();
    }

    private async Task NextTrackAsync()
    {
        try
        {
            await App.Services.Api.NextAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"next failed: {ex.Message}");
        }
    }

    private void OnSeekDragStarted(object? sender, PointerPressedEventArgs e)
    {
        _seekDragging = true;
        _pendingSeekSeconds = -1;
        _seekCommitTimer?.Stop();
    }

    private void OnSeekDragCompleted(object? sender, PointerReleasedEventArgs e)
    {
        _seekDragging = false;
        _seekCommitTimer?.Stop();
        ApplySeekTo(SeekSlider.Value);
    }

    private void OnSeekValueChanged(object? sender, RangeBaseValueChangedEventArgs e)
    {
        if (_suppressSeekValue)
        {
            return;
        }
        _pendingSeekSeconds = e.NewValue;
        CurrentTime.Text = FormatTime((int)(e.NewValue * 1000));
        if (_seekDragging)
        {
            return;
        }
        _seekCommitTimer?.Stop();
        _seekCommitTimer?.Start();
    }

    private void ApplySeekTo(double seconds)
    {
        CurrentTime.Text = FormatTime((int)(seconds * 1000));
        _ = SeekToAsync((int)seconds);
    }

    private async Task SeekToAsync(int seconds)
    {
        try
        {
            await App.Services.Api.SeekToAsync(seconds);
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"seekTo failed: {ex.Message}");
        }
    }

    private void OnVolumePointerPressed(object? sender, PointerPressedEventArgs e)
    {
        _volumeDragging = true;
    }

    private void OnVolumePointerReleased(object? sender, PointerReleasedEventArgs e)
    {
        _volumeDragging = false;
        ApplyVolume();
    }

    private void OnVolumeDragStarted(object? sender, PointerPressedEventArgs e)
    {
        _volumeDragging = true;
    }

    private void OnVolumeDragCompleted(object? sender, PointerReleasedEventArgs e)
    {
        _volumeDragging = false;
        ApplyVolume();
    }

    private void ApplyVolume()
    {
        _ = SetVolumeAsync((int)VolumeSlider.Value);
    }

    private async Task SetVolumeAsync(int value)
    {
        try
        {
            await App.Services.Api.SetUserDataAsync("volume", value);
        }
        catch (Exception ex)
        {
            AppLog.Write("playerbar", $"volume failed: {ex.Message}");
        }
    }
}