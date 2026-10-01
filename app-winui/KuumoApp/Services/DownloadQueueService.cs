using KuumoApp.Models;

namespace KuumoApp.Services;

public sealed class DownloadQueueService
{
    public async Task<string[]> GetQueueAsync()
        => await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.DownloadQueue) ?? [];

    public async Task<string[]> AddAsync(string source, string type, string id)
    {
        var entry = $"{source}:{type}:{id}";
        var queue = (await GetQueueAsync()).ToList();
        if (!queue.Contains(entry))
        {
            queue.Add(entry);
            await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, queue.ToArray());
        }
        return queue.ToArray();
    }

    public async Task<string[]> RemoveAsync(string entry)
    {
        var queue = (await GetQueueAsync()).Where(e => e != entry).ToList();
        await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, queue.ToArray());
        return queue.ToArray();
    }

    public async Task<string[]> ClearAsync()
    {
        await App.Services.Api.SetUserDataAsync(UserDataKeys.DownloadQueue, Array.Empty<string>());
        return [];
    }

    /// <summary>
    /// The backend refuses to download until a local folder is configured and answers with an
    /// unfriendly message, so gate it here and explain what the user is missing instead.
    /// </summary>
    public static async Task<bool> EnsureEnabledAsync()
    {
        if (await App.Services.Api.GetIsLocalAsync())
        {
            return true;
        }
        ToastService.ShowWarning("Downloads are off — choose a music folder in Settings first.");
        return false;
    }

    public async Task StartAsync()
    {
        try
        {
            await App.Services.Api.DownloadMusicAsync();
            ToastService.ShowInfo("Downloads finished");
        }
        catch (Exception ex)
        {
            AppLog.Write("downloads", $"start failed: {ex.Message}");
            ToastService.ShowError($"Download failed: {ex.Message}");
        }
    }
}
