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
}
