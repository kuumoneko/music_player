# AGENTS.md

Agent instructions for KuumoApp. Read fully before working — this file exists to avoid re-exploring the codebase.

## Overview

- KuumoApp v7: Windows-only music player (find/play/download YouTube songs, local files).
- **Stack**: Bun/TypeScript backend (`src/bun/`) + two C# frontends: WinUI 3 (`app-winui/KuumoApp/`) and Avalonia (`app-avalonia/KuumoApp/`). No React, no Electrobun — `README.md` is stale, don't trust it.
- IPC: WebSocket JSON-RPC (not HTTP). RPC contract lives in `src/shared/types.ts` (`AppRPCType`) — the single source of truth for method names, request/response/message types.
- Audio: `libmpv.dll` via `bun:ffi` `dlopen`. FFmpeg shared libs (avcodec/avformat) via FFI. No yt-dlp, no ffmpeg CLI.
- State persistence: sqlite (`bun:sqlite`) with `user_data`/`system` key-value tables — not in-memory.

## Commands (Bun only, never npm)

| Command | Purpose |
|---|---|
| `bun run dev` | Backend-only dev; **requires `apikeys/myown.json`**; encrypts credentials into `data/system.json`; data dir `data/dev/` |
| `bun run winui:dev` | Full loop: build backend + dotnet x64 + launch WinUI app (`KUUMO_DEV=1`, data dir `%APPDATA%\KuumoApp`) |
| `bun run avalonia:dev` | Full loop: build backend + dotnet x64 + launch Avalonia app (`KUUMO_DEV=1`, data dir `%APPDATA%\KuumoApp`) |
| `bun run typecheck` | `typecheck:bun` + `typecheck:dotnet` (both WinUI and Avalonia) |
| `bun run build:prod` | `Bun.build` → `build/backend.js` + copies `bin/` DLLs |
| `bun run winui:package` | Full release pipeline per profile → `artifacts/*.exe` (WinUI installer) |
| `bun run avalonia:package` | Full release pipeline per profile → `artifacts/*.exe` (Avalonia installer) |
| `bun run release` | GitHub draft release from `artifacts/` (needs `GH_TOKEN`/`GHUSERNAME`/`REPO` from `.env`) |
| `bun run encrypt-credentials` | Bake encrypted `apikeys/<profile>.json` into `data/system.json` |
| `bun run build-sparse-package` | Build sparse MSIX package for Avalonia (gives Store-like integration) |
| `bun run compare-packaging` | Benchmark WinUI vs Avalonia packaging speed |

**No tests exist.** Typecheck is the verification path — run `bun run typecheck` after changes.

## Architecture

```
src/bun/                 TS backend (56 files)
  index.ts               Entry: args, seed, Player, QueueManager, RpcWsServer, prints KUUMO_WS=
  controllers/           home, music, search, download (business logic)
  db/                    bun:sqlite layer; db/index.ts is the barrel — import from "../db/index.ts" only
  music/                 Player class (composition root), play.ts (mpv wrapper, EventEmitter), youtube resolvers
  music/youtube-data-api/index.ts   Largest file (796 lines) — YouTube Data API v3
  rpc/                   ws-server.ts (Bun.serve WS), handlers.ts (createRpcHandlers)
  ffmpeg/                dlopen of avformat/avcodec DLLs
  auth/google.ts         OAuth for signed-in user's YouTube playlists
  queue/manager.ts       Download queue
src/shared/              Contract shared with frontend
  types.ts               AppRPCType (requests/messages), domain models, enums
  constants.ts, time.ts, utils/formatArtist.ts
app-winui/KuumoApp/      WinUI 3 frontend
  Services/              RpcClient.cs (WS JSON-RPC), RpcApi.cs (typed wrappers, 60s timeout),
                         BunHostService.cs (spawns backend, parses KUUMO_WS=), AppServices.cs (composition root)
  Views/                 ShellPage, HomePage, SearchPage, DetailPage, DownloadsPage, LocalPage, SettingsPage...
app-winui/Launcher/      Tiny launcher exe (single-file, framework-dependent). Installed layout:
                         root = launcher KuumoApp.exe + app\ folder holding the full flat payload
                         (real apphost, DLLs, include\, Assets\, data\) + app\backend\ holding
                         bun.exe + index.js (shared Bun runtime + JS bundle). The .NET host
                         resolves everything relative to app\KuumoApp.exe, so the payload is untouched.
app-avalonia/KuumoApp/   Avalonia frontend (alternative to WinUI)
  Program.cs             Entry point, AUMID registration, sparse package registration
  StartMenuHelper.cs     Creates Start Menu shortcut with AUMID via COM IPropertyStore
  Services/              Same services as WinUI (RpcClient, RpcApi, BunHostService, etc.)
  Views/                 Same pages as WinUI but in .axaml format
  SparsePackage/         Sparse MSIX identity for Windows Store-like integration
scripts/                 dev.ts, winui-dev.ts, avalonia-dev.ts, build.ts, package.ts, avalonia-package.ts, release.ts, encrypt-credentials.ts...
```

### IPC protocol
- Request: `{id, method, params}` → Response: `{id, result}` or `{id, error: {message}}`.
- Server push: `{event, data}` (e.g. `timeUpdate`, `playerStateChange`, `currentTrackChanged`, `download-status-changed`, `error`, `open-app`).
- Frontend discovers endpoint from `KUUMO_WS=ws://<ip>:<port>/ws` line in backend stdout (also stored in sqlite `log` table). Backend MUST print it.
- RPC handler names must match `AppRPCType.requests` keys; handlers use `withRateLimit` (500ms) and `withErrorLog` wrappers.
- Single instance: HTTP GET to own port before bind → success means `process.exit(42)`.

### Data dirs
- Dev backend: `data/dev/`. Installed/winui-dev app: `%APPDATA%\KuumoApp\app_data.sqlite`. Default repo `data/` if no `--data-dir`.
- `data/system.json` is seeded into sqlite at startup; deleted in production, kept in dev (`KUUMO_DEV !== "1"`).

## Conventions

- **TS**: camelCase filenames, `index.ts` as folder entry; default-exported PascalCase classes (`Player`, `RpcWsServer`); plain exported functions for utilities; relative imports (with or without `.ts` — both allowed).
- **Indentation split (match the file you edit)**: 2-space in `src/bun/rpc/`, `src/bun/lib/args.ts`, `src/bun/db/setup.ts`; 4-space everywhere else.
- **Enums**: PascalCase names/members, except `SleepMode`/`Status` (lowercase string members).
- **Error idiom everywhere**: `e instanceof Error ? e.message : String(e)`.
- **C#**: file-scoped namespaces, 4-space indent, `_camelCase` private fields, `sealed partial class`, nullable enabled.
- tsconfig: `strict`, `noUnusedLocals/Parameters`, `@/*` → `./src/*` path alias. Must not break `bunx tsc --noEmit`.

## Critical gotchas

- **Secrets — never commit or log**: `apikeys/*.json` (gitignored), `.env` (gitignored), `data/system.json` (encrypted creds, gitignored). Credentials are AES-256-GCM obfuscated with hardcoded key `kuumoapp::ship-credentials::v1` in `src/bun/lib/crypto.ts` (`ENC:` prefix) — obfuscation, not real security.
- **Gitignored runtime dirs — do not edit**: `bin/` (native DLLs: libmpv, avcodec-62, avformat-62, avutil-60, swresample-6, libssp-0), `build/` (bundle/package output), `artifacts/`, `assets/`, `app-winui/KuumoApp/bin/` + `obj/`, `app-winui/Launcher/bin/` + `obj/`, `app-avalonia/KuumoApp/bin/` + `obj/`, `data/`.
- **Interlocking version pins — keep in sync**: WinAppSDK 2.3.1 (csproj) ↔ Bootstrap `0x00020003` (`Program.cs`) ↔ WindowsAppRuntime 2.3.1 (`install-prereqs.ps1`) ↔ .NET Desktop Runtime 10.0.9.
- **PUBLISH_TRIM in `scripts/package.ts`**: only remove DLLs also listed in `setup.iss` `[InstallDelete]`. `Microsoft.InteractiveExperiences.Projection.dll` must NOT be trimmed (0xC000027B crash).
- `package.json` `dependencies: {"bun": "^1.3.14"}` is a runtime marker placeholder — do not remove.
- Dev profile is hardcoded as `"myown"` in dev.ts and winui-dev.ts.
- `--seed` mode is installer-only (imports system.json, best-effort exit 0).
- Windows-only; shell is PowerShell 5.1 — no `&&` in chained commands.
- Git commit style: conventional-ish (`fix(...)`, `feat(winui): ...`, `refactor: ...`). There may be uncommitted work in the worktree — check `git status` before assuming a clean state.
- **Avalonia dev AUMID**: `KuumoAvalonia.dev` (vs WinUI's `kuumo.app.dev`). Shortcut name: "Kuumo Avalonia Test" (vs "KuumoApp WinUI Test"). Both check `KUUMO_DEV=1` env var.
- **Avalonia installer AUMID**: `KuumoAvalonia` (vs WinUI's `kuumo.app`). Different AppIds in Inno Setup.
- **Avalonia sparse package**: `scripts/build-sparse-package.ts` generates a self-signed MSIX for Store-like integration without full MSIX deployment.
- **Avalonia has no Launcher project**: the Avalonia exe IS the entry point (flat layout). WinUI needs a separate Launcher exe to resolve paths.
- **Avalonia installs .NET only**: `scripts/install-prereqs-avalonia.ps1` installs just .NET Desktop Runtime (no WASDK). WinUI's `install-prereqs.ps1` installs both .NET + WASDK.