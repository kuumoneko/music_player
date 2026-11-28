# KuumoApp v7

Windows-only music player (YouTube + local). **Stack**: Bun/TS backend (`src/bun/`) + WinUI 3 C# frontend (`app-winui/KuumoApp/`). No React, no Electrobun (`README.md` is stale).
- **IPC**: WebSocket JSON-RPC; contract in `src/shared/types.ts` (`AppRPCType`).
- **Audio**: `libmpv.dll` + FFmpeg DLLs (`avcodec`/`avformat`) via `bun:ffi` `dlopen` (no yt-dlp/ffmpeg CLI).
- **DB**: `bun:sqlite` (`user_data`, `system` KV tables) at `%APPDATA%\KuumoApp\app_data.sqlite` (shared between `dev` and installed app `F:\KuumoApp`).

## Directory Map
- `src/bun/`: `index.ts` (entry, prints `KUUMO_WS=`), `controllers/` (home, music, search, download), `db/` (barrel `../db/index.ts` only), `music/` (`Player`, `play.ts` mpv EventEmitter, `resolvers`, `youtube/`, `youtube-data-api/index.ts`), `rpc/` (`ws-server.ts`, `handlers.ts`), `ffmpeg/`, `auth/google.ts`, `queue/manager.ts`, `lib/` (`args`, `crypto`, `env`, `retry`), `cache/`, `discord/`
- `src/shared/`: `types.ts` (`AppRPCType`, models, enums), `constants.ts`, `time.ts`, `utils/formatArtist.ts`
- `app-winui/KuumoApp.slnx`:
  - `KuumoApp/`: `Views/` (ShellPage, HomePage, SearchPage, DetailPage, DownloadsPage, LocalPage, SettingsPage...), `Controls/`, `Services/` (`RpcClient.cs`, `RpcApi.cs` 60s timeout, `BunHostService.cs`, `AppServices.cs`)
  - `Launcher/`: single-file launcher `KuumoApp.exe` → spawns `app\KuumoApp.exe` + `app\backend\` (`bun.exe` + `index.js`)
- `scripts/`: `build.ts`, `package.ts` (`PUBLISH_TRIM`), `release.ts`, `dev.ts`, `dev-artifacts.ts`, `encrypt-credentials.ts`, `test-rpc.ts`, `CheckShortcut/`, `StampIcon/`
- `tests/`: `unit/` (`bun/`, `shared/`), `helpers/preload.ts` (isolates DB), `fixtures/`, `manual/refresh-artist.ts`
- `setup.iss` (Inno Setup), `package.json`, `tsconfig.json` (`strict`, `noUnusedLocals/Parameters`, `@/*` → `./src/*`)
- **Gitignored — never edit/read**: `bin/`, `build/`, `artifacts/`, `assets/`, `data/`, `apikeys/`, and all `bin/` + `obj/` folders.

## Commands (Bun only, never npm; PowerShell 5.1 — no `&&`)
| Command | Purpose |
|---|---|
| `bun run typecheck` | `typecheck:bun` + `typecheck:dotnet` (main verification gate) |
| `bun run test` | `bun test tests/unit` (`test:integration` is manual) |
| `bun run build` | `Bun.build` → `build/backend.js` + copies `bin/` DLLs |
| `bun run package` | Release pipeline per profile → `artifacts/*.exe` |
| `bun run dev` | Host dev loop (`bun run dev` alias). Flags: `--force`, `--stop`, `--skip-backend`, `--skip-winui` |
| `bun run encrypt-credentials` | Encrypt `apikeys/<profile>.json` → `data/system.json` |
| `bun run release` | GitHub draft release from `artifacts/` (uses `.env`) |

- **Dev loop**: `dev` spawns backend (`--data-dir %APPDATA%\KuumoApp --port 0 --no-lock`) + WinUI (`KUUMO_DEV=1`). Never run installed `F:\KuumoApp` concurrently (`--force` kills it).
- **Package profiles** (`scripts/package.ts`): `stable` (default) → `artifacts/kuumoapp_{version}-setup.exe`; any other name → `artifacts/kuumoapp_<profile>_{version}-setup.exe`. `PUBLISH_TRIM=1` trims unused WinAppSDK DLLs from the publish output (see Trimming gotcha below).

## IPC & Data
- JSON-RPC: `{id, method, params}` → `{id, result}` or `{id, error: {message}}`. Push events: `{event, data}` (`timeUpdate`, `playerStateChange`, `currentTrackChanged`, `download-status-changed`, `error`, `open-app`).
- Backend MUST print `KUUMO_WS=ws://<ip>:<port>/ws`. Handlers match `AppRPCType.requests`, wrapped with `withRateLimit` (500ms) + `withErrorLog`. Single-instance check exits `42` if port responds.
- `data/system.json` seeds sqlite at startup (deleted in prod, kept when `KUUMO_DEV !== "1"`). `data/dev/` is only for `test-rpc.ts`.

## Conventions
- **TS**: camelCase files, `index.ts` entry, default-exported PascalCase classes, named utility functions. Indent: 2-space in `src/bun/rpc/`, `src/bun/lib/args.ts`, `src/bun/db/setup.ts`; 4-space elsewhere. Enums: PascalCase (except lowercase `SleepMode`/`Status`). Error idiom: `e instanceof Error ? e.message : String(e)`. Must pass `bunx tsc --noEmit`.
- **C#**: file-scoped namespaces, 4-space indent, `_camelCase` private fields, `sealed partial class`, nullable enabled.

## Critical Gotchas
- **Secrets (never commit/log)**: `apikeys/*.json`, `.env`, `data/system.json` (`ENC:` AES-256-GCM obfuscated in `src/bun/lib/crypto.ts`).
- **Version pins (keep synced)**: WinAppSDK 2.3.1 (`.csproj`) ↔ Bootstrap `0x00020003` (`Program.cs`) ↔ WindowsAppRuntime 2.3.1 (`install-prereqs.ps1`) ↔ .NET Desktop Runtime 10.0.9.
- **Trimming (`scripts/package.ts`)**: only trim DLLs also in `setup.iss` `[InstallDelete]`. Never trim `Microsoft.InteractiveExperiences.Projection.dll` (0xC000027B crash).
- Keep `package.json` `"bun": "^1.4.0"` placeholder; dev profile is `"myown"`; `--seed` is installer-only; check `git status` before assuming clean worktree; update Directory Map when files move/delete.
