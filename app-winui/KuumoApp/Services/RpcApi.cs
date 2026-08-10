using System.Text.Json;
using KuumoApp.Models;

namespace KuumoApp.Services;

public sealed class RpcApi
{
    private readonly RpcClient _rpc;

    public RpcApi(RpcClient rpc)
    {
        _rpc = rpc;
    }

    private Task<T> Call<T>(string method, object? parameters = null, int timeoutMs = 60_000)
        => _rpc.CallAsync<T>(method, parameters, timeoutMs);

    // --- App ---
    public Task<bool> GetIsLocalAsync() => Call<bool>("getIsLocal");
    public Task<string> DownloadMusicAsync() => Call<string>("downloadMusic");
    public Task<DownloadStatusDto?> GetDownloadStatusAsync() => Call<DownloadStatusDto?>("getDownloadStatus");
    public Task CloseAsync() => Call<object?>("close");
    public Task MinimizeAsync() => Call<object?>("minimize");
    public Task ToggleQuitOnCloseAsync() => Call<object?>("toggleQuitOnClose");
    public Task<bool?> IsQuitOnCloseAsync() => Call<bool?>("isQuitOnClose");
    public Task<object?> CheckUpdateAsync() => Call<object?>("checkUpdate");
    public Task UpdateAsync() => Call<object?>("update");
    public Task<object?> OpenDevToolsAsync() => Call<object?>("openDevTools");
    public Task SendErrorAsync(string message) => Call<object?>("sendError", new { message });

    // --- Player ---
    public Task TogglePlayPauseAsync() => Call<object?>("togglePlayPause");
    public Task<PlayingDataDto?> GetPlayingDataAsync() => Call<PlayingDataDto?>("getPlayingData");
    public Task<CurrentTrackChangedDto?> GetCurrentPlayingAsync() => Call<CurrentTrackChangedDto?>("getCurrentPlaying");
    public Task NextAsync() => Call<object?>("next");
    public Task PreviousAsync() => Call<object?>("previous");
    public Task SeekToAsync(int seconds) => Call<object?>("seekTo", seconds);
    public Task SetSleepAsync(string mode) => Call<object?>("setSleep", mode);
    public Task PlayAsync(TrackDto item, string source, string type, string id)
        => Call<object?>("play", new { item, source, type, id });

    // --- User data ---
    public async Task<T?> GetUserDataAsync<T>(string key)
    {
        var el = await _rpc.CallAsync<JsonElement?>("getUserData", key);
        if (el is null || el.Value.ValueKind == JsonValueKind.Null) return default;
        try { return el.Value.Deserialize<T>(RpcClient.Json); }
        catch (JsonException) { return default; }
    }
    public Task<object?> SetUserDataAsync(string key, object data) => Call<object?>("setUserData", new { key, data });

    // --- Music browsing ---
    public Task<JsonElement?> GetMusicDataAsync(string source, string type, string id)
        => Call<JsonElement?>("getMusicData", new { source, type, id });
    public Task<SearchResultDto?> SearchMusicAsync(string type, string source, string query)
        => Call<SearchResultDto?>("searchMusic", new { type, source, query });
    public Task<HomeDataDto?> GetHomeDataAsync() => Call<HomeDataDto?>("getHomeData");
    public Task<HomeFeedDto?> GetHomeFeedAsync() => Call<HomeFeedDto?>("getHomeFeed");
    public Task<TrackDto[]?> GetLocalfileAsync() => Call<TrackDto[]?>("getLocalfile");
    public Task<JsonElement?[]?> GetQueueDataAsync(string[] ids) => Call<JsonElement?[]?>("getQueueData", ids);
    public Task AddToBatchQueueAsync(string source, string type, string id)
        => Call<object?>("addToBatchQueue", new { source, type, id });
    public Task<string?> GetImageDataUriAsync(string url) => Call<string?>("getImageDataUri", url);

    // --- Thumbnails / cookies ---
    public Task<string?> ResolveThumbnailUrlAsync(string id, string type)
        => Call<string?>("resolveThumbnailUrl", new { id, type });
    public Task<string?> GetYtCookiesAsync() => Call<string?>("getYtCookies");
    public Task<string?> SetYtCookiesAsync(string cookies) => Call<string?>("setYtCookies", new { cookies });
    public Task<string?> ClearYtCookiesAsync() => Call<string?>("clearYtCookies");

    // --- YouTube API keys ---
    public Task<string[]?> GetYoutubeApiKeysAsync() => Call<string[]?>("getYoutubeApiKeys");
    public Task<string[]?> AddYoutubeApiKeyAsync(string key) => Call<string[]?>("addYoutubeApiKey", new { key });
    public Task<string[]?> RemoveYoutubeApiKeyAsync(string key) => Call<string[]?>("removeYoutubeApiKey", new { key });
    public Task<string[]?> ImportYoutubeApiKeysAsync(string[] keys) => Call<string[]?>("importYoutubeApiKeys", new { keys });

    // --- Playlists ---
    public Task<PlaylistDto?> CreatePlaylistAsync(string name) => Call<PlaylistDto?>("createPlaylist", new { name });
    public Task DeletePlaylistAsync(string id) => Call<object?>("deletePlaylist", new { id });
    public Task<PlaylistDto[]?> GetUserPlaylistsAsync() => Call<PlaylistDto[]?>("getUserPlaylists");
    public Task AddToPlaylistAsync(string playlistId, TrackDto track)
        => Call<object?>("addToPlaylist", new { playlistId, track });
    public Task RemoveFromPlaylistAsync(string playlistId, string trackId)
        => Call<object?>("removeFromPlaylist", new { playlistId, trackId });
    public Task<object?> RefreshPlaylistAsync(string id) => Call<object?>("refreshPlaylist", new { id });
    public Task<object?> RefreshArtistAsync(string id) => Call<object?>("refreshArtist", new { id });

    // --- Discord ---
    public Task<object?> IsHasDiscordRpcAsync() => Call<object?>("isHasDiscordRPC");
    public Task<string?> ConnectDiscordRpcAsync() => Call<string?>("connectDiscordRPC");
    public Task DisconnectDiscordRpcAsync() => Call<object?>("disconnectDiscordRPC");

    // --- Google ---
    public Task<GoogleAuthStateDto?> GetGoogleAuthStatusAsync() => Call<GoogleAuthStateDto?>("getGoogleAuthStatus");
    public Task SaveGoogleCredentialsAsync(string clientId)
        => Call<object?>("saveGoogleCredentials", new { clientId });
    public Task ClearGoogleCredentialsAsync() => Call<object?>("clearGoogleCredentials");
    public Task<SignInResultDto?> SignInWithGoogleAsync() => Call<SignInResultDto?>("signInWithGoogle");
    public Task SignOutAsync() => Call<object?>("signOut");
    public Task<PlaylistDto[]?> GetUserYoutubePlaylistsAsync() => Call<PlaylistDto[]?>("getUserYoutubePlaylists");
    public Task<ArtistDto[]?> GetUserYoutubeSubscriptionsAsync() => Call<ArtistDto[]?>("getUserYoutubeSubscriptions");
    public Task<TrackDto[]?> GetUserYoutubePlaylistTracksAsync(string playlistId)
        => Call<TrackDto[]?>("getUserYoutubePlaylistTracks", new { playlistId });
}

