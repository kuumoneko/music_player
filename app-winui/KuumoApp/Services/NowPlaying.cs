using System.Runtime.CompilerServices;
using KuumoApp.Views;
using Microsoft.UI.Xaml.Controls;

namespace KuumoApp.Services;

/// <summary>
/// Keeps the "now playing" marker on track rows in sync with playback.
///
/// Rows pick up the flag when they are built (TrackRow.FromTrack); the lists are
/// registered here so a track change repaints rows already on screen. Lists are held
/// weakly, so a page that forgets to unwatch can never leak.
/// </summary>
public static class NowPlaying
{
    private static readonly ConditionalWeakTable<ListView, object> Watched = new();
    private static bool _hooked;

    public static string Source { get; private set; } = "";
    public static string Id { get; private set; } = "";

    public static bool Matches(string? source, string? id)
        => !string.IsNullOrEmpty(id) && source == Source && id == Id;

    public static void Watch(ListView list)
    {
        EnsureHooked();
        Watched.Remove(list);
        Watched.GetValue(list, static _ => new object());
        ApplyTo(list.ItemsSource);
    }

    public static void Unwatch(ListView list) => Watched.Remove(list);

    /// <summary>Classic bindings cannot cast a bool to <c>Visibility</c>/<c>Opacity</c>.</summary>
    public static void ApplyTo(object? itemsSource)
    {
        if (itemsSource is not IEnumerable<TrackRow> rows)
        {
            return;
        }
        foreach (var row in rows)
        {
            row.IsPlaying = Matches(row.Source, row.Id);
        }
    }

    private static void EnsureHooked()
    {
        if (_hooked)
        {
            return;
        }
        _hooked = true;
        App.Services.Events.CurrentTrackChanged += dto =>
        {
            Source = dto.Source ?? "";
            Id = dto.Id ?? "";
            Refresh();
        };
        _ = SeedAsync();
    }

    private static async Task SeedAsync()
    {
        try
        {
            var current = await App.Services.Api.GetCurrentPlayingAsync();
            if (current is null)
            {
                return;
            }
            Source = current.Source ?? "";
            Id = current.Id ?? "";
            Refresh();
        }
        catch (Exception ex)
        {
            AppLog.Write("nowplaying", $"seed failed: {ex.Message}");
        }
    }

    private static void Refresh()
    {
        foreach (var entry in Watched)
        {
            ApplyTo(entry.Key.ItemsSource);
        }
    }
}
