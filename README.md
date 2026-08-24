# KuumoApp

> A Windows music player that finds, plays, downloads songs from YouTube and plays your local files.

## Version

> 7.0.006

## Features

### YouTube
- Search tracks, playlists, and artists
- Stream audio via InnerTube (no yt-dlp dependency)
- Queue entire playlists or artists
- Google account sign-in to access your YouTube playlists and subscriptions

### Playback
- 10-band equalizer with presets (Flat, Bass Boost, Treble Boost, Rock, Pop, Classical)
- Shuffle and repeat (off / one / all)
- Sleep timer (5, 10, 15, 30, 45 min, 1 hour, end of track)
- Smooth volume fades on track change
- Windows System Media Transport Controls (SMTC) — media keys and taskbar controls
- Live stream support (HLS/DASH)

### Local Music
- Scan a folder for local audio files (MP3, M4A, FLAC, WAV, OGG, AAC)
- Metadata and cover art extraction via FFmpeg
- Incremental re-scan (only re-parses changed files)

### Downloads
- Queue tracks, playlists, or artists for download
- Up to 4 concurrent downloads
- Converts to M4A with embedded metadata and cover art
- Fuzzy dedup — skips already-downloaded tracks

### Queue Management
- Auto-refill from current artist/playlist context
- Batch queue (queue entire artist/playlist to play next)
- Anti-loop protection

### Discord Rich Presence
- Shows currently playing track with thumbnail and timestamps
- Toggle on/off from settings

### UI
- Dark / Light / System theme
- Accent color extracted from album artwork
- Close to tray
- Pinned items on home screen

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | WinUI 3 (C#) + Windows App SDK 2.3.1 |
| Backend | Bun + TypeScript |
| Audio | libmpv via FFI |
| Audio processing | FFmpeg shared libraries via FFI |
| IPC | WebSocket JSON-RPC |
| Database | SQLite |
| Installer | Inno Setup |

## Installation

Download the latest `setup.exe` from [Releases](https://github.com/kuumoneko/music_player/releases/latest).

The installer will:
1. Install .NET Desktop Runtime 10.0.9 and Windows App SDK runtime 2.3.1 if missing
2. Install KuumoApp to `%LOCALAPPDATA%\KuumoApp` (per-user, no admin required)
3. Optionally create desktop/start menu shortcuts

## Building from Source

**Prerequisites:**
- [Bun](https://bun.sh) runtime
- .NET 10 SDK
- Windows App SDK 2.3.1

```bash
# Type check
bun run typecheck

# Build backend bundle
bun run build:prod

# Full package (builds everything, creates installer in artifacts/)
bun run package
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Left/Right` | Previous / Next track |
| `Ctrl+Up/Down` | Volume up / down |
| `Ctrl+M` | Mute toggle |
| `Ctrl+S` | Shuffle toggle |
| `Ctrl+R` | Repeat cycle |
| `Ctrl+F` | Focus search |
| `Space` | Play / Pause |
| `Alt+Left/Right` | Navigate back / forward |

## Development

See [AGENTS.md](AGENTS.md) for architecture details, code conventions, and development workflow.

## License

[MIT](LICENSE) — Copyright © 2025 Kuumoneko
