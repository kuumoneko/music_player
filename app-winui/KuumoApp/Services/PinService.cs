using System.Text.Json;
using KuumoApp.Models;

namespace KuumoApp.Services;

public sealed class PinService
{
    public async Task<string[]> GetPinsAsync()
        => await App.Services.Api.GetUserDataAsync<string[]>(UserDataKeys.Pin) ?? [];

    public async Task<bool> IsPinnedAsync(string source, string type, string id)
    {
        var entry = $"{source}:{type}:{id}";
        var pins = await GetPinsAsync();
        return pins.Contains(entry);
    }

    public async Task<string[]> TogglePinAsync(string source, string type, string id)
    {
        var entry = $"{source}:{type}:{id}";
        var pins = (await GetPinsAsync()).ToList();
        if (!pins.Remove(entry))
        {
            pins.Add(entry);
        }
        var result = pins.ToArray();
        await App.Services.Api.SetUserDataAsync(UserDataKeys.Pin, result);
        App.Services.Events.RaiseRefetch();
        return result;
    }

    public async Task<string[]> SetPinnedAsync(string[] pins)
    {
        await App.Services.Api.SetUserDataAsync(UserDataKeys.Pin, pins);
        return pins;
    }

    public static string EntryFor(string source, string type, string id) => $"{source}:{type}:{id}";
}
