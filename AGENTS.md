# AGENTS.md

Agent instructions for KuumoApp. Read fully before working — this file exists to avoid re-exploring the codebase.

## Overview

- KuumoApp v7: Windows-only music player (find/play/download YouTube songs, local files).
- **Stack**: Bun/TypeScript backend (`src/bun/`) + WinUI 3 C# frontend (`app-winui/KuumoApp/`). No React, no Electrobun — `README.md` is stale, don't trust it.
- IPC: WebSocket JSON-RPC (not HTTP). RPC contract lives in `src/shared/types.ts` (`AppRPCType`) — the single source of truth for method names, request/response/message types.
- Audio: `libmpv.dll` via `bun:ffi` `dlopen`. FFmpeg shared libs (avcodec/avformat) via FFI. No yt-dlp, no ffmpeg CLI.
- State persistence: sqlite (`bun:sqlite`) with `user_data`/`system` key-value tables — not in-memory.

## Directory Map

```
E:\coding\kuumoapp\
  AGENTS.md                Agent instructions, this file
  package.json             Bun scripts + dep marker
  tsconfig.json            Strict TS, @/* → ./src/*
  setup.iss                Inno Setup, WinUI installer
  src/
    bun/                   TypeScript backend
      index.ts             Entry: args, seed, Player, QueueManager, RpcWsServer, prints KUUMO_WS=
      controllers/         home, music, search, download business logic
      db/                  sqlite layer; index.ts is the barrel — import from "../db/index.ts" only
      music/               Player (composition root), play.ts (mpv wrapper, EventEmitter), resolvers
      music/youtube-data-api/index.ts   YouTube Data API v3
      music/youtube/       InnerTube parsers + session
      rpc/                 ws-server.ts (Bun.serve WS), handlers.ts (createRpcHandlers)
      ffmpeg/              dlopen of avformat/avcodec DLLs
      auth/google.ts       OAuth for signed-in user's playlists
      queue/manager.ts     Download queue
      lib/                 args, crypto, env, retry helpers
      cache/               Resource cache
      discord/             Rich presence
    shared/                IPC contract shared with frontends
      types.ts             AppRPCType (requests/messages), domain models, enums
      constants.ts, time.ts, utils/formatArtist.ts
  app-winui/               WinUI 3 frontend + Launcher
    KuumoApp/              WinUI app: Views/ (ShellPage, HomePage, SearchPage, DetailPage,
                           DownloadsPage, LocalPage, SettingsPage...), Services/, Controls/
      Services/            RpcClient.cs (WS JSON-RPC), RpcApi.cs (typed wrappers, 60s timeout),
                           BunHostService.cs (spawns backend, parses KUUMO_WS=),
                           AppServices.cs (composition root)
    Launcher/              Tiny launcher exe (single-file, framework-dependent). Installed layout:
                           root = launcher KuumoApp.exe + app\ (flat payload: apphost, DLLs,
                           include\, Assets\, data\) + app\backend\ (bun.exe + index.js). The .NET
                           host resolves everything relative to app\KuumoApp.exe, so the payload is untouched.
    KuumoApp.slnx          WinUI solution file
  scripts/                 Build, package, dev loops
    build.ts               Bun bundle + DLL copy
    package.ts             WinUI release pipeline (PUBLISH_TRIM lives here)
    release.ts             GitHub draft release
    dev.ts                 Thin dispatcher → winui-dev.ts
    winui-dev.ts           Host dev loop, WinUI
    dev-artifacts.ts       Dev shortcut cleanup (guarded to this checkout)
    encrypt-credentials.ts Encrypt apikeys into system.json
    test-rpc.ts            Manual RPC smoke client
    CheckShortcut/         AUMID .lnk writer/reader (write --aumid <id> --name <title>)
    StampIcon/             Icon stamping tool
  tests/                   refresh-artist test + sqlite fixture
  bin/                     Native DLLs (gitignored, do not edit)
  build/                   Bundle/package output (gitignored)
  artifacts/               Installers + update JSON (gitignored)
  data/                    sqlite + system.json (gitignored)
  apikeys/                 Per-profile creds (gitignored, secret)
  assets/                  Runtime assets (gitignored)
```

## Commands (Bun only, never npm)

| Command | Purpose |
|---|---|
| `bun run typecheck` | `typecheck:bun` + `typecheck:dotnet` (WinUI) |
| `bun run build:prod` | `Bun.build` → `build/backend.js` + copies `bin/` DLLs |
| `bun run winui:package` | Full release pipeline per profile → `artifacts/*.exe` (WinUI installer) |
| `bun run release` | GitHub draft release from `artifacts/` (needs `GH_TOKEN`/`GHUSERNAME`/`REPO` from `.env`) |
| `bun run encrypt-credentials` | Bake encrypted `apikeys/<profile>.json` into `data/system.json` |
| `bun run dev` | Build + launch the WinUI frontend on this host (alias for `winui:dev`) |
| `bun run winui:dev` | Same, WinUI only. Flags: `--force`, `--stop`, `--skip-backend`, `--skip-winui` |

**Host-side dev loop** (the app runs on this machine, not in a VM):

1. `bun run winui:dev` once → encrypts credentials, bundles + copies `bin/` DLLs to `build/`, `dotnet build`s the frontend, writes the AUMID Start Menu shortcut, spawns the backend (`bun build/backend.js --data-dir %APPDATA%\KuumoApp --assets <root> --port 0 --no-lock`, cwd `build/`) and the app with `KUUMO_DEV=1`.
2. Edit code → `r` → full kill + rebuild + relaunch. `q` / Ctrl+C → kill + remove dev artifacts + exit. `--skip-backend` makes `r` frontend-only.
3. Non-TTY (CI) → one cycle then exit; the app is left running.

**Dev runs share the real `%APPDATA%\KuumoApp` database — never run the installed app (`F:\KuumoApp`) at the same time.** `winui:dev` refuses to start if a `KuumoApp.exe` outside this checkout is running (`--force` stops it instead). The backend's single-instance lock is inert here because dev passes `--port 0 --no-lock`, so the process guard above is what prevents two backends from fighting — not the lock.

Artifacts removed at the start of each run, on `q`, and on `--stop`: the Start Menu shortcut `KuumoApp WinUI Test`. `scripts/dev-artifacts.ts` owns the removal and refuses to touch shortcuts that don't point back at this checkout.

**Verification.** Typecheck is the main gate; `tests/refresh-artist.test.ts` covers artist refresh; `scripts/test-rpc.ts` is a manual smoke client.

## IPC protocol

- Request: `{id, method, params}` → Response: `{id, result}` or `{id, error: {message}}`.
- Server push: `{event, data}` (e.g. `timeUpdate`, `playerStateChange`, `currentTrackChanged`, `download-status-changed`, `error`, `open-app`).
- Frontend discovers endpoint from `KUUMO_WS=ws://<ip>:<port>/ws` line in backend stdout (also stored in sqlite `log` table). Backend MUST print it.
- RPC handler names must match `AppRPCType.requests` keys; handlers use `withRateLimit` (500ms) and `withErrorLog` wrappers.
- Single instance: HTTP GET to own port before bind → success means `process.exit(42)`.

## Data dirs

- App data: `%APPDATA%\KuumoApp\app_data.sqlite` (the shared, real database — `winui:dev` and the installed app all use it). `data/dev/` survives only as the `test-rpc.ts` data dir / seed fallback. Default repo `data/` if no `--data-dir`.
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
- **Gitignored runtime dirs — do not edit**: `bin/` (native DLLs), `build/` (bundle/package output), `artifacts/`, `assets/`, `data/`, `apikeys/`, plus every `bin/` + `obj/` under `app-winui/KuumoApp/`, `app-winui/Launcher/`, `scripts/CheckShortcut/`, `scripts/StampIcon/`.
- **Interlocking version pins — keep in sync**: WinAppSDK 2.3.1 (csproj) ↔ Bootstrap `0x00020003` (`Program.cs`) ↔ WindowsAppRuntime 2.3.1 (`install-prereqs.ps1`) ↔ .NET Desktop Runtime 10.0.9.
- **PUBLISH_TRIM in `scripts/package.ts`**: only remove DLLs also listed in `setup.iss` `[InstallDelete]`. `Microsoft.InteractiveExperiences.Projection.dll` must NOT be trimmed (0xC000027B crash).
- `package.json` `dependencies: {"bun": "^1.3.14"}` is a runtime marker placeholder — do not remove.
- Dev profile is hardcoded as `"myown"` in `winui-dev.ts` and `test-rpc.ts`.
- `--seed` mode is installer-only (imports system.json, best-effort exit 0).
- Windows-only; shell is PowerShell 5.1 — no `&&` in chained commands.
- Git commit style: conventional-ish (`fix(...)`, `feat(winui): ...`, `refactor: ...`). There may be uncommitted work in the worktree — check `git status` before assuming a clean state.
- Check the Directory Map above before calling glob/find; update the Directory Map whenever files are created, renamed, or deleted.
