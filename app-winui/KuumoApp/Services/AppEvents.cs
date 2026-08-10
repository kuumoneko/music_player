using System.Text.Json;
using KuumoApp.Models;
using Microsoft.UI.Dispatching;

namespace KuumoApp.Services;

public sealed class AppEvents
{
    private readonly DispatcherQueue _dispatcher;

    public event Action<TimeUpdateDto>? TimeUpdated;
    public event Action<PlayerStateChangeDto>? PlayerStateChanged;
    public event Action<CurrentTrackChangedDto>? CurrentTrackChanged;
    public event Action<SettingsChangedDto>? SettingsChanged;
    public event Action<QueueChangedDto>? QueueChanged;
    public event Action<ErrorDto>? ErrorReceived;
    public event Action<DownloadStatusDto>? DownloadStatusChanged;
    public event Action? LocalFilesChanged;
    public event Action<SmtcUpdateDto>? SmtcUpdated;
    public event Action<ShowMessageDto>? MessageReceived;
    public event Action<GoogleAuthStateDto>? GoogleAuthStateChanged;
    public event Action<string>? DataChanged;
    public event Action? OpenApp;
    public event Action? AppExit;
    public event Action? TrackUnavailable;
    public event Action? RefetchRequested;

    public void RaiseRefetch()
    {
        if (RefetchRequested is not null)
        {
            _dispatcher.TryEnqueue(() => RefetchRequested());
        }
    }

    public AppEvents(DispatcherQueue dispatcher)
    {
        _dispatcher = dispatcher;
    }

    public void OnEvent(string name, JsonElement data)
    {
        switch (name)
        {
            case "timeUpdate":
                Raise(TimeUpdated, () => data.Deserialize<TimeUpdateDto>(RpcClient.Json));
                break;
            case "playerStateChange":
                Raise(PlayerStateChanged, () => data.Deserialize<PlayerStateChangeDto>(RpcClient.Json));
                break;
            case "currentTrackChanged":
                Raise(CurrentTrackChanged, () => data.Deserialize<CurrentTrackChangedDto>(RpcClient.Json));
                break;
            case "settingsChanged":
                Raise(SettingsChanged, () => data.Deserialize<SettingsChangedDto>(RpcClient.Json));
                break;
            case "queueChanged":
                Raise(QueueChanged, () => data.Deserialize<QueueChangedDto>(RpcClient.Json));
                break;
            case "error":
                Raise(ErrorReceived, () => data.Deserialize<ErrorDto>(RpcClient.Json));
                break;
            case "download-status-changed":
                Raise(DownloadStatusChanged, () => data.Deserialize<DownloadStatusDto>(RpcClient.Json));
                break;
            case "local-files-changed":
                if (LocalFilesChanged is not null) _dispatcher.TryEnqueue(() => LocalFilesChanged());
                break;
            case "smtc-update":
                Raise(SmtcUpdated, () => data.Deserialize<SmtcUpdateDto>(RpcClient.Json));
                break;
            case "showMessage":
                Raise(MessageReceived, () => data.Deserialize<ShowMessageDto>(RpcClient.Json));
                break;
            case "googleAuthState":
                Raise(GoogleAuthStateChanged, () => data.Deserialize<GoogleAuthStateDto>(RpcClient.Json));
                break;
            case "dataChanged":
                if (DataChanged is not null)
                {
                    string? key = null;
                    try
                    {
                        key = data.GetProperty("key").GetString();
                    }
                    catch (Exception ex)
                    {
                        AppLog.Write("events", $"failed to read dataChanged key: {ex.Message}");
                    }
                    if (key is not null)
                    {
                        _dispatcher.TryEnqueue(() => DataChanged(key));
                    }
                }
                break;
            case "open-app":
                if (OpenApp is not null) _dispatcher.TryEnqueue(() => OpenApp());
                break;
            case "app-exit":
                if (AppExit is not null) _dispatcher.TryEnqueue(() => AppExit());
                break;
            case "trackUnavailable":
                if (TrackUnavailable is not null) _dispatcher.TryEnqueue(() => TrackUnavailable());
                break;
            case "refetch":
                if (RefetchRequested is not null) _dispatcher.TryEnqueue(() => RefetchRequested());
                break;
        }
    }

    private void Raise<T>(Action<T>? handler, Func<T?> convert)
    {
        if (handler is null)
        {
            return;
        }
        T? value;
        try
        {
            value = convert();
        }
        catch (Exception ex)
        {
            AppLog.Write("events", $"failed to deserialize event: {ex.Message}");
            return;
        }
        if (value is not null)
        {
            _dispatcher.TryEnqueue(() => handler(value));
        }
    }
}
