using System.Text.Json;

namespace KuumoApp.Models;

public static class MusicType
{
    public const string Artist = "artist";
    public const string Playlist = "playlist";
    public const string Track = "track";
    public const string Local = "local";
}

public static class MusicSource
{
    public const string Youtube = "youtube";
    public const string Local = "local";
}

public static class SleepMode
{
    public const string No = "nosleep";
    public const string Five = "after 5 minutes";
    public const string Ten = "after 10 minutes";
    public const string Fifteen = "after 15 minutes";
    public const string Thirty = "after 30 minutes";
    public const string FortyFive = "after 45 minutes";
    public const string Hour = "after 1 hour";
    public const string EndOfTrack = "end of this track";
}

public static class Status
{
    public const string Idle = "idle";
    public const string Downloading = "downloading";
    public const string Done = "done";
    public const string Env = "env";
    public const string Prepare = "prepare";
    public const string Error = "error";
}

public static class UserDataKeys
{
    public const string Repeat = "repeat";
    public const string Shuffle = "shuffle";
    public const string Volume = "volume";
    public const string CurrentPlaying = "currentPlaying";
    public const string Nextfrom = "nextfrom";
    public const string PlayedTrack = "playedTrack";
    public const string QuitOnClose = "QuitOnClose";
    public const string CloseToTray = "closeToTray";
    public const string Current = "current";
    public const string IsPlaying = "isPlaying";
    public const string IsLoading = "isLoading";
    public const string PlayQueue = "playQueue";
    public const string BatchQueue = "batchQueue";
    public const string Folder = "folder";
    public const string Pin = "pin";
    public const string DownloadQueue = "downloadQueue";
    public const string YoutubeApiKeys = "youtubeApiKeys";
    public const string EqualizerBands = "equalizerBands";
    public const string EqualizerEnabled = "equalizerEnabled";
    public const string GoogleClientId = "googleClientId";
    public const string GoogleClientSecret = "googleClientSecret";
    public const string YtCookies = "ytCookies";
}

public enum Shuffle
{
    Disable = 0,
    Enable = 1,
}

public enum Repeat
{
    Disable = 0,
    One = 1,
    All = 2,
}

public record TrackArtistDto(string Id, string Name);

public record TrackDto(
    string Name,
    string Id,
    TrackArtistDto[] Artist,
    string Source,
    string Thumbnail,
    int Duration,
    string ReleasedDate,
    int? Index = null,
    long? FileModifiedAt = null,
    string? YoutubeTrackId = null);

public record PlaylistDto(
    string Name,
    string Id,
    string Source,
    TrackDto[]? Tracks = null,
    string[]? Ids = null,
    string Thumbnail = "",
    int Duration = 0,
    int? ItemCount = null,
    long? LastFetched = null);

public record ArtistDto(
    string Name,
    string Id,
    string Source,
    TrackDto[]? Tracks = null,
    string Thumbnail = "",
    string PlaylistId = "",
    long? LastFetched = null,
    long? CacheTtl = null);

public record SearchResultDto(TrackDto[] Tracks, PlaylistDto[] Playlists, ArtistDto[] Artists);

public record HomeDataDto(ArtistDto[] Artists, PlaylistDto[] Playlists, TrackDto[] Tracks, TrackDto[] NewTracks);

public record HomeFeedSectionDto(string Title, string Type, JsonElement[] Items, string ItemType);

public record HomeFeedDto(HomeFeedSectionDto[] Sections);

public record PlayingDataDto(
    int Shuffle,
    int Repeat,
    bool IsPlaying,
    bool IsLoading,
    string[] PlayedTrack,
    PlayingCurrentDto Current);

public record PlayingCurrentDto(double Time, double Duration, bool IsLived, bool IsPlaying);

public record DownloadStatusDto(string Data, string Track);

public record GoogleAuthStateDto(bool IsSignedIn, string? Email = null, long? ExpiresAt = null);

public record SignInResultDto(bool Success, string? AuthUrl = null, int? Port = null);

public record EqualizerBandDto(int Freq, int Gain);

public record ApiKeyListItemDto(string Raw, string Masked);

// --- Events ---

public record TimeUpdateDto(double Time, bool IsPlaying);

public record PlayerStateChangeDto(bool IsPlaying, bool IsLoading, double Duration, bool IsLived);

public record CurrentTrackChangedDto(string Source, string Id, string Title, string Thumbnail, string Artist, string ArtistId);

public record SettingsChangedDto(int Shuffle, int Repeat, int Volume);

public record QueueChangedDto(string[] PlayQueue, string[] BatchQueue, string Nextfrom, string[] PlayedTrack);

public record ErrorDto(string Message, string? Stack = null);

public record ShowMessageDto(string Title, string Message);

public record SmtcUpdateDto(string? Title, string? Artist, string? Thumbnail, bool IsList, bool IsPlaying);
