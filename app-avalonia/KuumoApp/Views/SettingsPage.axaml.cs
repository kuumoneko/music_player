using System.Diagnostics;
using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using KuumoApp.Controls;
using KuumoApp.Models;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class SettingsPage : UserControl
{
    private readonly List<string> _presets = ["Flat", "Bass Boost", "Treble Boost", "Rock", "Pop", "Classical"];
    private bool _loading;

    public SettingsPage()
    {
        InitializeComponent();
        PresetBox.ItemsSource = _presets;
        AttachedToVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected += OnRpcConnected;
            App.Services.Events.GoogleAuthStateChanged += OnGoogleAuthStateChanged;
            if (App.Services.Rpc.IsConnected)
            {
                _ = LoadAsync();
            }
        };
        DetachedFromVisualTree += (_, _) =>
        {
            App.Services.Rpc.Connected -= OnRpcConnected;
            App.Services.Events.GoogleAuthStateChanged -= OnGoogleAuthStateChanged;
        };
    }

    private void OnGoogleAuthStateChanged(GoogleAuthStateDto state)
    {
        GoogleText.Text = state.IsSignedIn ? $"Signed in as {state.Email}" : "Sign-in failed";
        SignInButton.IsVisible = !state.IsSignedIn;
        SignOutButton.IsVisible = state.IsSignedIn;
    }

    private void OnRpcConnected() => Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = LoadAsync());

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
            EqualizerSwitch.IsChecked = eqEnabledTask.Result;
            if (quitTask.Result is JsonElement q)
            {
                QuitOnCloseSwitch.IsChecked = q.ValueKind == JsonValueKind.True
                    || (q.ValueKind == JsonValueKind.String && q.GetString() == "true");
            }
            if (closeToTrayTask.Result is JsonElement c)
            {
                CloseToTraySwitch.IsChecked = c.ValueKind == JsonValueKind.True
                    || (c.ValueKind == JsonValueKind.String && c.GetString() == "true");
            }
            var themeMode = themeTask.Result ?? "system";
            DarkThemeRadio.IsChecked = themeMode == "dark";
            LightThemeRadio.IsChecked = themeMode == "light";
            SystemThemeRadio.IsChecked = themeMode != "dark" && themeMode != "light";
            DynamicAccentSwitch.IsChecked = ThemeService.ParseAccentFlag(accentTask.Result);
            var folder = folderTask.Result;
            FolderText.Text = string.IsNullOrEmpty(folder) ? "Not set" : folder;
            DiscordText.Text = discordTask.Result is JsonElement { ValueKind: JsonValueKind.String or JsonValueKind.True }
                ? "Connected" : "Not connected";

            try
            {
                var google = await App.Services.Api.GetGoogleAuthStatusAsync();
                if (google is { HasOAuth: true })
                {
                    GoogleSection.IsVisible = true;
                    GoogleText.Text = google.IsSignedIn ? $"Signed in as {google.Email}" : "Not signed in";
                    SignInButton.IsVisible = !google.IsSignedIn;
                    SignOutButton.IsVisible = google.IsSignedIn;
                }
                else
                {
                    GoogleSection.IsVisible = false;
                }
            }
            catch (Exception ex)
            {
                AppLog.Write("settings", $"google status load failed: {ex.Message}");
                GoogleSection.IsVisible = false;
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
            RemoveApiKeyButton.IsVisible = false;
        }
        else
        {
            ApiKeysStatusText.Text = $"{keys.Length} API key(s) configured";
            RemoveApiKeyButton.IsVisible = true;
        }
    }

    private async void OnQuitOnCloseToggled(object? sender, RoutedEventArgs e)
    {
        if (_loading) return;
        try
        {
            await App.Services.Rpc.CallAsync<object?>("toggleQuitOnClose");
            if (App.Services.Window is not null)
            {
                App.Services.Window.IsQuitOnClose = QuitOnCloseSwitch.IsChecked == true;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"toggleQuitOnClose failed: {ex.Message}");
        }
    }

    private async void OnCloseToTrayToggled(object? sender, RoutedEventArgs e)
    {
        if (_loading) return;
        try
        {
            await App.Services.Api.SetUserDataAsync(UserDataKeys.CloseToTray, CloseToTraySwitch.IsChecked == true);
            if (App.Services.Window is not null)
            {
                App.Services.Window.IsCloseToTray = CloseToTraySwitch.IsChecked == true;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"closeToTray failed: {ex.Message}");
        }
    }

    private async void OnThemeModeChanged(object? sender, RoutedEventArgs e)
    {
        if (_loading) return;
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

    private async void OnDynamicAccentToggled(object? sender, RoutedEventArgs e)
    {
        if (_loading) return;
        try
        {
            await App.Services.Api.SetUserDataAsync("dynamicAccent", DynamicAccentSwitch.IsChecked == true);
            App.Services.Theme.SetDynamicAccent(DynamicAccentSwitch.IsChecked == true);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"dynamic accent failed: {ex.Message}");
        }
    }

    private async void OnPresetChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (_loading || PresetBox.SelectedItem is not string preset || preset == "Custom") return;
        _presets.Remove("Custom");
        PresetBox.ItemsSource = _presets.ToList();
        try
        {
            var gains = preset switch
            {
                "Bass Boost" => new[] { 6, 5, 4, 2, 0, 0, 0, 0, 0, 0 },
                "Treble Boost" => new[] { 0, 0, 0, 0, 0, 0, 2, 4, 5, 6 },
                "Rock" => new[] { 5, 4, 2, 1, 0, 0, 1, 3, 4, 5 },
                "Pop" => new[] { 0, 0, 0, 2, 3, 4, 3, 2, 1, 1 },
                "Classical" => new[] { 4, 3, 2, 1, 0, 0, 0, 2, 3, 4 },
                _ => new[] { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
            };
            var bands = BuildBands(gains);
            EqGraph.SetBands(bands);
            await App.Services.Api.SetUserDataAsync("equalizerBands", bands);
            await App.Services.Api.SetUserDataAsync("equalizerEnabled", true);
            EqualizerSwitch.IsChecked = true;
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"preset failed: {ex.Message}");
        }
    }

    private async void OnEqualizerToggled(object? sender, RoutedEventArgs e)
    {
        if (_loading) return;
        try
        {
            await App.Services.Api.SetUserDataAsync("equalizerEnabled", EqualizerSwitch.IsChecked == true);
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
            PresetBox.ItemsSource = _presets.ToList();
        }
        PresetBox.SelectedItem = "Custom";
        try
        {
            await App.Services.Api.SetUserDataAsync("equalizerBands", bands);
            if (EqualizerSwitch.IsChecked != true)
            {
                EqualizerSwitch.IsChecked = true;
            }
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"equalizer bands failed: {ex.Message}");
        }
    }

    private async void OnEqResetClick(object? sender, RoutedEventArgs e)
    {
        _presets.Remove("Custom");
        PresetBox.ItemsSource = _presets.ToList();
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
        if (el is not { } e || e.ValueKind != JsonValueKind.Array) return [];
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

    private async void OnChooseFolderClick(object? sender, RoutedEventArgs e)
    {
        try
        {
            var topLevel = TopLevel.GetTopLevel(this);
            if (topLevel?.StorageProvider is null) return;
            var folders = await topLevel.StorageProvider.OpenFolderPickerAsync(new Avalonia.Platform.Storage.FolderPickerOpenOptions
            {
                Title = "Choose music folder",
                AllowMultiple = false,
            });
            if (folders.Count == 0) return;
            var folder = folders[0];
            var path = folder.Path.ToString();
            var result = await App.Services.Api.SetUserDataAsync(UserDataKeys.Folder, path);
            FolderText.Text = (result is string p && !string.IsNullOrEmpty(p)) ? p : path;
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"folder failed: {ex.Message}");
        }
    }

    private async void OnRehashClick(object? sender, RoutedEventArgs e)
    {
        try
        {
            await App.Services.Api.RehashLocalFilesAsync();
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"rehash failed: {ex.Message}");
        }
    }

    private async void OnDiscordConnectClick(object? sender, RoutedEventArgs e)
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

    private async void OnDiscordDisconnectClick(object? sender, RoutedEventArgs e)
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

    private async void OnSignInClick(object? sender, RoutedEventArgs e)
    {
        try
        {
            var result = await App.Services.Api.SignInWithGoogleAsync();
            if (result is { Success: true, AuthUrl: not null } && result.AuthUrl.Length > 0)
            {
                Process.Start(new ProcessStartInfo(result.AuthUrl) { UseShellExecute = true });
                GoogleText.Text = "Waiting for sign-in in browser...";
                SignInButton.IsVisible = false;
                SignOutButton.IsVisible = false;
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

    private async void OnSignOutClick(object? sender, RoutedEventArgs e)
    {
        try
        {
            await App.Services.Api.SignOutAsync();
            GoogleText.Text = "Signed out";
            SignInButton.IsVisible = true;
            SignOutButton.IsVisible = false;
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"sign out failed: {ex.Message}");
        }
    }

    private async void OnAddApiKeyClick(object? sender, RoutedEventArgs e)
    {
        var key = ApiKeyTextBox.Text?.Trim();
        if (string.IsNullOrEmpty(key)) return;
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

    private async void OnRemoveApiKeyClick(object? sender, RoutedEventArgs e)
    {
        try
        {
            var keys = await App.Services.Api.GetYoutubeApiKeysAsync();
            if (keys == null || keys.Length == 0) return;
            var updatedKeys = await App.Services.Api.RemoveYoutubeApiKeyAsync(keys[0]);
            UpdateApiKeysUi(updatedKeys);
        }
        catch (Exception ex)
        {
            AppLog.Write("settings", $"remove api key failed: {ex.Message}");
        }
    }
}