using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using Windows.Storage.Pickers;

namespace KuumoApp.Views;

public sealed partial class SettingsPage : Page
{
    private readonly ObservableCollection<string> _presets = new() { "Flat", "Bass Boost", "Treble Boost", "Rock", "Pop", "Classical" };

    private bool _loading;

    public SettingsPage()
    {
        InitializeComponent();
        PresetBox.ItemsSource = _presets;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        App.Services.Rpc.Connected += OnRpcConnected;
        App.Services.Events.GoogleAuthStateChanged += OnGoogleAuthStateChanged;
        if (!App.Services.Rpc.IsConnected)
        {
            return;
        }
        _ = LoadAsync();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        App.Services.Rpc.Connected -= OnRpcConnected;
        App.Services.Events.GoogleAuthStateChanged -= OnGoogleAuthStateChanged;
    }

    private void OnGoogleAuthStateChanged(GoogleAuthStateDto state)
    {
        GoogleText.Text = state.IsSignedIn ? $"Signed in as {state.Email}" : "Sign-in failed";
        UpdateGoogleAuthUi(state.IsSignedIn);
    }

    private void UpdateGoogleAuthUi(bool isSignedIn)
    {
        SignInButton.Visibility = isSignedIn ? Visibility.Collapsed : Visibility.Visible;
        SignOutButton.Visibility = isSignedIn ? Visibility.Visible : Visibility.Collapsed;
    }

    private void OnRpcConnected() => DispatcherQueue.TryEnqueue(() => _ = LoadAsync());

    private async Task LoadAsync()
    {
        _loading = true;
        try
        {
            var bandsTask = App.Services.Api.GetUserDataAsync<JsonElement?>("equalizerBands");
            var eqEnabledTask = App.Services.Api.GetUserDataAsync<bool>("equalizerEnabled");
            var quitTask = App.Services.Rpc.CallAsync<JsonElement?>("getUserData", UserDataKeys.QuitOnClose);
            var closeToTrayTask = App.Services.Rpc.CallAsync<JsonElement?>("getUserData", UserDataKeys.CloseToTray);
            var themeTask = App.Services.Api.GetUserDataAsync<string>("themeMode");
            var accentTask = App.Services.Api.GetUserDataAsync<JsonElement?>("dynamicAccent");
            var folderTask = App.Services.Api.GetUserDataAsync<string>(UserDataKeys.Folder);
            var discordTask = App.Services.Api.IsHasDiscordRpcAsync();

            await Task.WhenAll(bandsTask, eqEnabledTask, quitTask, closeToTrayTask, themeTask, accentTask, folderTask, discordTask);

            EqGraph.SetBands(ParseBands(bandsTask.Result));
            EqualizerSwitch.IsOn = eqEnabledTask.Result;
            if (quitTask.Result is JsonElement q)
            {
                QuitOnCloseSwitch.IsOn = q.ValueKind == JsonValueKind.True
                    || (q.ValueKind == JsonValueKind.String && q.GetString() == "true");
            }
            if (closeToTrayTask.Result is JsonElement c)
            {
                CloseToTraySwitch.IsOn = c.ValueKind == JsonValueKind.True
                    || (c.ValueKind == JsonValueKind.String && c.GetString() == "true");
            }
            var themeMode = themeTask.Result ?? "system";
            DarkThemeRadio.IsChecked = themeMode == "dark";
            LightThemeRadio.IsChecked = themeMode == "light";
            SystemThemeRadio.IsChecked = themeMode != "dark" && themeMode != "light";
            DynamicAccentSwitch.IsOn = ThemeService.ParseAccentFlag(accentTask.Result);
            var folder = folderTask.Result;
            FolderText.Text = string.IsNullOrEmpty(folder) ? "Not set" : folder;
            DiscordText.Text = discordTask.Result is JsonElement { ValueKind: JsonValueKind.String or JsonValueKind.True }
                ? "Connected"
                : "Not connected";

            try
            {
                var google = await App.Services.Api.GetGoogleAuthStatusAsync();
                if (google is { HasOAuth: true })
                {
                    GoogleSection.Visibility = Visibility.Visible;
                    if (google.IsSignedIn)
                    {
                        GoogleText.Text = $"Signed in as {google.Email}";
                    }
                    else
                    {
                        GoogleText.Text = "Not signed in";
                    }
                    UpdateGoogleAuthUi(google.IsSignedIn);
                }
                else
                {
                    GoogleSection.Visibility = Visibility.Collapsed;
                }
            }
            catch (Exception ex)
            {
                AppLog.Write("settings", $"google status load failed: {ex.Message}");
                GoogleSection.Visibility = Visibility.Collapsed;
            }

            try
            {
                var keys = await App.Services.Api.GetYoutubeApiKeysAsync();
                UpdateApiKeysUi(keys);
            }
            catch (Exception ex)
            {
                AppLog.Write("settings", $"api keys load failed: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"load failed: {ex.Message}");
        }
        finally
        {
            _loading = false;
        }
    }

    private void UpdateApiKeysUi(string[]? keys)
    {
        if (keys == null || keys.Length == 0)
        {
            ApiKeysStatusText.Text = "No API keys configured";
            RemoveApiKeyButton.Visibility = Visibility.Collapsed;
        }
        else
        {
            ApiKeysStatusText.Text = $"{keys.Length} API key(s) configured";
            RemoveApiKeyButton.Visibility = Visibility.Visible;
        }
    }

    private async void OnQuitOnCloseToggled(object sender, RoutedEventArgs e)
    {
        if (_loading)
        {
            return;
        }
        try
        {
            await App.Services.Rpc.CallAsync<object?>("toggleQuitOnClose");
            if (App.Services.Window is not null)
            {
                App.Services.Window.IsQuitOnClose = QuitOnCloseSwitch.IsOn;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"toggleQuitOnClose failed: {ex.Message}");
        }
    }

    private async void OnCloseToTrayToggled(object sender, RoutedEventArgs e)
    {
        if (_loading)
        {
            return;
        }
        try
        {
            await App.Services.Api.SetUserDataAsync(UserDataKeys.CloseToTray, CloseToTraySwitch.IsOn);
            if (App.Services.Window is not null)
            {
                App.Services.Window.IsCloseToTray = CloseToTraySwitch.IsOn;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"closeToTray failed: {ex.Message}");
        }
    }

    private async void OnThemeModeChanged(object sender, RoutedEventArgs e)
    {
        if (_loading)
        {
            return;
        }
        var mode = DarkThemeRadio.IsChecked == true ? "dark" : LightThemeRadio.IsChecked == true ? "light" : "system";
        try
        {
            await App.Services.Api.SetUserDataAsync("themeMode", mode);
            App.Services.Theme.SetMode(mode);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"theme mode failed: {ex.Message}");
        }
    }

    private async void OnDynamicAccentToggled(object sender, RoutedEventArgs e)
    {
        if (_loading)
        {
            return;
        }
        try
        {
            await App.Services.Api.SetUserDataAsync("dynamicAccent", DynamicAccentSwitch.IsOn);
            App.Services.Theme.SetDynamicAccent(DynamicAccentSwitch.IsOn);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"dynamic accent failed: {ex.Message}");
        }
    }

    private async void OnPresetChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loading || PresetBox.SelectedItem is not string preset)
        {
            return;
        }
        if (preset == "Custom")
        {
            return;
        }
        _presets.Remove("Custom");
        try
        {
            var gains = new[] { 0, 6, 5, 4, 2, 0, 0, 0, 0, 0 };
            if (preset == "Bass Boost") gains = new[] { 6, 5, 4, 2, 0, 0, 0, 0, 0, 0 };
            else if (preset == "Treble Boost") gains = new[] { 0, 0, 0, 0, 0, 0, 2, 4, 5, 6 };
            else if (preset == "Rock") gains = new[] { 5, 4, 2, 1, 0, 0, 1, 3, 4, 5 };
            else if (preset == "Pop") gains = new[] { 0, 0, 0, 2, 3, 4, 3, 2, 1, 1 };
            else if (preset == "Classical") gains = new[] { 4, 3, 2, 1, 0, 0, 0, 2, 3, 4 };
            var bands = BuildBands(gains);
            EqGraph.SetBands(bands);
            await App.Services.Api.SetUserDataAsync("equalizerBands", bands);
            await App.Services.Api.SetUserDataAsync("equalizerEnabled", true);
            EqualizerSwitch.IsOn = true;
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"preset failed: {ex.Message}");
        }
    }

    private async void OnEqualizerToggled(object sender, RoutedEventArgs e)
    {
        if (_loading)
        {
            return;
        }
        try
        {
            await App.Services.Api.SetUserDataAsync("equalizerEnabled", EqualizerSwitch.IsOn);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"equalizer toggle failed: {ex.Message}");
        }
    }

    private async void OnEqBandsChanged(EqualizerBandDto[] bands)
    {
        if (!_presets.Contains("Custom"))
        {
            _presets.Add("Custom");
        }
        PresetBox.SelectedItem = "Custom";
        try
        {
            await App.Services.Api.SetUserDataAsync("equalizerBands", bands);
            if (!EqualizerSwitch.IsOn)
            {
                EqualizerSwitch.IsOn = true;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"equalizer bands failed: {ex.Message}");
        }
    }

    private async void OnEqResetClick(object sender, RoutedEventArgs e)
    {
        _presets.Remove("Custom");
        PresetBox.SelectedIndex = -1;
        var bands = BuildBands(new int[10]);
        EqGraph.SetBands(bands);
        try
        {
            await App.Services.Api.SetUserDataAsync("equalizerBands", bands);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"equalizer reset failed: {ex.Message}");
        }
    }

    private static EqualizerBandDto[] BuildBands(int[] gains)
    {
        var freqs = new[] { 31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 };
        return freqs.Select((f, i) => new EqualizerBandDto(f, gains[i])).ToArray();
    }

    private static EqualizerBandDto[] ParseBands(JsonElement? el)
    {
        if (el is not { } e || e.ValueKind != JsonValueKind.Array)
        {
            return [];
        }
        var freqs = new[] { 31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 };
        var result = new List<EqualizerBandDto>();
        var i = 0;
        foreach (var item in e.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Object)
            {
                var freq = FindPropInt(item, "freq");
                var gain = FindPropInt(item, "gain");
                if (freq is not null && gain is not null)
                {
                    result.Add(new EqualizerBandDto(freq.Value, gain.Value));
                    continue;
                }
            }
            else if (item.ValueKind == JsonValueKind.Number && i < freqs.Length)
            {
                result.Add(new EqualizerBandDto(freqs[i], item.GetInt32()));
                i++;
            }
        }
        return result.ToArray();
    }

    private static int? FindPropInt(JsonElement obj, string name)
    {
        foreach (var p in obj.EnumerateObject())
        {
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                return p.Value.ValueKind == JsonValueKind.Number && p.Value.TryGetInt32(out var v) ? v : null;
            }
        }
        return null;
    }

    private async void OnChooseFolderClick(object sender, RoutedEventArgs e)
    {
        try
        {
            var picker = new FolderPicker { SuggestedStartLocation = PickerLocationId.MusicLibrary };
            picker.FileTypeFilter.Add("*");
            var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow);
            WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);
            var folder = await picker.PickSingleFolderAsync();
            if (folder is null)
            {
                return;
            }
            var result = await App.Services.Api.SetUserDataAsync(UserDataKeys.Folder, folder.Path);
            if (result is not null && result is string path && !string.IsNullOrEmpty(path))
            {
                FolderText.Text = path;
            }
            else
            {
                FolderText.Text = folder.Path;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"folder failed: {ex.Message}");
        }
    }

    private async void OnDiscordConnectClick(object sender, RoutedEventArgs e)
    {
        try
        {
            var result = await App.Services.Api.ConnectDiscordRpcAsync();
            DiscordText.Text = string.IsNullOrEmpty(result) ? "Not connected" : $"Connected as {result}";
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"discord connect failed: {ex.Message}");
        }
    }

    private async void OnDiscordDisconnectClick(object sender, RoutedEventArgs e)
    {
        try
        {
            await App.Services.Api.DisconnectDiscordRpcAsync();
            DiscordText.Text = "Not connected";
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"discord disconnect failed: {ex.Message}");
        }
    }

    private async void OnSignInClick(object sender, RoutedEventArgs e)
    {
        try
        {
            var result = await App.Services.Api.SignInWithGoogleAsync();
            if (result is { Success: true, AuthUrl: not null } && result.AuthUrl.Length > 0)
            {
                Process.Start(new ProcessStartInfo(result.AuthUrl) { UseShellExecute = true });
                GoogleText.Text = "Waiting for sign-in in browser...";
                SignInButton.Visibility = Visibility.Collapsed;
                SignOutButton.Visibility = Visibility.Collapsed;
            }
            else
            {
                GoogleText.Text = "Sign-in unavailable - no Client ID configured";
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"sign in failed: {ex.Message}");
        }
    }

    private async void OnSignOutClick(object sender, RoutedEventArgs e)
    {
        try
        {
            await App.Services.Api.SignOutAsync();
            GoogleText.Text = "Signed out";
            UpdateGoogleAuthUi(false);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"sign out failed: {ex.Message}");
        }
    }

    private async void OnAddApiKeyClick(object sender, RoutedEventArgs e)
    {
        var key = ApiKeyTextBox.Text?.Trim();
        if (string.IsNullOrEmpty(key))
        {
            return;
        }
        try
        {
            var keys = await App.Services.Api.AddYoutubeApiKeyAsync(key);
            UpdateApiKeysUi(keys);
            ApiKeyTextBox.Text = "";
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"add api key failed: {ex.Message}");
        }
    }

    private async void OnRemoveApiKeyClick(object sender, RoutedEventArgs e)
    {
        try
        {
            var keys = await App.Services.Api.GetYoutubeApiKeysAsync();
            if (keys == null || keys.Length == 0)
            {
                return;
            }
            var key = keys[0];
            var updatedKeys = await App.Services.Api.RemoveYoutubeApiKeyAsync(key);
            UpdateApiKeysUi(updatedKeys);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"remove api key failed: {ex.Message}");
        }
    }
}
