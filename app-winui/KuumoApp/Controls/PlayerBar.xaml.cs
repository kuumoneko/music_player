using System.Text.Json;
using KuumoApp.Models;
using KuumoApp.Services;
using KuumoApp.Views;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;

namespace KuumoApp.Controls;

public sealed partial class PlayerBar : UserControl
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
    private readonly DispatcherQueueTimer _seekCommitTimer;

    public PlayerBar()
    {
        InitializeComponent();
        _seekCommitTimer = DispatcherQueue.CreateTimer();
        _seekCommitTimer.Interval = TimeSpan.FromMilliseconds(250);
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
        App.Services.Events.TimeUpdated += data => DispatcherQueue.TryEnqueue(() => SetTime(data));
        App.Services.Events.PlayerStateChanged += data => DispatcherQueue.TryEnqueue(() => SetPlayerState(data));
        App.Services.Events.CurrentTrackChanged += data => DispatcherQueue.TryEnqueue(() => SetTrack(data));
        App.Services.Events.SettingsChanged += data => DispatcherQueue.TryEnqueue(() => SetSettings(data));
        App.Services.Events.QueueChanged += data => DispatcherQueue.TryEnqueue(() => SetNextFrom(data.Nextfrom));
        App.Services.Rpc.Connected += () => DispatcherQueue.TryEnqueue(() => _ = LoadInitialStateAsync());
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
            await ImageAttach.LoadAsync(Thumb, url);
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
            LiveBadge.Visibility = data.IsLived ? Visibility.Visible : Visibility.Collapsed;
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
        RepeatIcon.Glyph = _repeat == 1 ? "\uE8ED" : "\uE8EE";
        RepeatIcon.Foreground = _repeat != 0 ? accent : idle;
    }

    private void UpdateVolumeIcon()
    {
        VolumeIcon.Glyph = VolumeSlider.Value <= 0 ? "\uE74F" : "\uE767";
    }

    private static Brush AccentBrush()
    {
        if (Application.Current.Resources.TryGetValue("AppAccentBrush", out var value) && value is Brush brush)
        {
            return brush;
        }
        return Application.Current.Resources.TryGetValue("AccentFillColorDefaultBrush", out var themeValue) && themeValue is Brush themeBrush
            ? themeBrush
            : new SolidColorBrush(Microsoft.UI.Colors.DodgerBlue);
    }

    private static Brush IdleBrush() =>
        Application.Current.Resources.TryGetValue("TextFillColorSecondaryBrush", out var value) && value is Brush brush
            ? brush
            : new SolidColorBrush(Microsoft.UI.Colors.Gray);

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

    private async void OnShuffleClick(object sender, RoutedEventArgs e)
    {
        ToggleShuffle();
    }

    private async void OnRepeatClick(object sender, RoutedEventArgs e)
    {
        CycleRepeat();
    }

    private void OnMuteClick(object sender, RoutedEventArgs e)
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

    private async void OnSleepModeClick(object sender, RoutedEventArgs e)
    {
        if (sender is MenuFlyoutItem item && item.Tag is string mode)
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
        }
    }

    private void UpdateSleepUi()
    {
        var active = _sleepMode != SleepMode.No;
        SleepIcon.Foreground = active ? AccentBrush() : IdleBrush();
        var label = SleepLabel(_sleepMode);
        if (active && label.Length > 0)
        {
            SleepModeText.Text = label;
            SleepModeText.Visibility = Visibility.Visible;
        }
        else
        {
            SleepModeText.Visibility = Visibility.Collapsed;
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
            TrackFrom.Visibility = Visibility.Collapsed;
            return;
        }
        if (!EntryFormat.TryParse(nextfrom, out var source, out var type, out var id))
        {
            _resolvedNextfrom = nextfrom;
            TrackFrom.Visibility = Visibility.Collapsed;
            return;
        }
        if (type == MusicType.Track || type == MusicType.Local)
        {
            _resolvedNextfrom = nextfrom;
            TrackFrom.Visibility = Visibility.Collapsed;
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
                    TrackFrom.Visibility = Visibility.Collapsed;
                    return;
                }
                _resolvedNextfrom = nextfrom;
                TrackFrom.Text = $"From: {name}";
                TrackFrom.Visibility = Visibility.Visible;
            }
            else
            {
                _resolvedNextfrom = nextfrom;
                TrackFrom.Visibility = Visibility.Collapsed;
            }
        }
        catch (Exception ex)
        {
            _resolvedNextfrom = nextfrom;
            AppLog.Write("playerbar", $"nextfrom resolve failed: {ex.Message}");
            TrackFrom.Visibility = Visibility.Collapsed;
        }
    }

    private void OnTrackFromTapped(object sender, Microsoft.UI.Xaml.Input.TappedRoutedEventArgs e)
    {
        if (EntryFormat.TryParse(_nextfrom, out var source, out var type, out var id))
        {
            ShellPage.NavigateDetail(source, type, id);
        }
    }

    private void OnTrackTitleTapped(object sender, Microsoft.UI.Xaml.Input.TappedRoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentId))
        {
            ShellPage.NavigateDetail(_currentSource, MusicType.Track, _currentId);
        }
    }

    private void OnTrackArtistTapped(object sender, Microsoft.UI.Xaml.Input.TappedRoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentArtistId))
        {
            ShellPage.NavigateDetail(_currentSource, MusicType.Artist, _currentArtistId);
        }
    }

    private void UpdatePlayPauseIcon()
    {
        PlayPauseIcon.Glyph = _isPlaying ? "\uE769" : "\uE768";
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

    private async void OnPlayPauseClick(object sender, RoutedEventArgs e)
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

    private async void OnPrevClick(object sender, RoutedEventArgs e)
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

    private async void OnNextClick(object sender, RoutedEventArgs e)
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

    private void OnSeekDragStarted(object sender, DragStartedEventArgs e)
    {
        _seekDragging = true;
        _pendingSeekSeconds = -1;
        _seekCommitTimer.Stop();
    }

    private void OnSeekDragCompleted(object sender, DragCompletedEventArgs e)
    {
        _seekDragging = false;
        _seekCommitTimer.Stop();
        ApplySeekTo(SeekSlider.Value);
    }

    private void OnSeekValueChanged(object sender, RangeBaseValueChangedEventArgs e)
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
        _seekCommitTimer.Stop();
        _seekCommitTimer.Start();
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

    private void OnVolumePointerPressed(object sender, PointerRoutedEventArgs e)
    {
        _volumeDragging = true;
    }

    private void OnVolumePointerReleased(object sender, PointerRoutedEventArgs e)
    {
        _volumeDragging = false;
        ApplyVolume();
    }

    private void OnVolumeDragStarted(object sender, DragStartedEventArgs e)
    {
        _volumeDragging = true;
    }

    private void OnVolumeDragCompleted(object sender, DragCompletedEventArgs e)
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
