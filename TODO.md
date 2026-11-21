# TODO

## Network retry / offline recovery for Player

Context: `Player` (`src/bun/music/index.ts`) has no network-retry logic. Retries live in
`music/youtube/index.ts` (3 attempts, fixed 1s, session invalidate on attempt 2),
`music/youtube-resolver.ts` (2 attempts, no delay), and `music/youtube-data-api/index.ts`
(2 attempts, 500ms×n, 15s timeout). A brief outage during playback hits mpv `end-file`
reason 4 in `music/play.ts`, which is treated as a normal EOF and silently skips the track.

- [ ] 1.1 Add `src/bun/lib/retry.ts` — `withRetry(fn, { attempts, baseDelayMs, factor, jitter, isRetryable })` plus `isNetworkError(e)` (TypeError, ECONNRESET, ETIMEDOUT, AbortError, status 0).
- [ ] 1.2 Adopt `withRetry` in `music/youtube/index.ts` (resolveStreamUrl), `music/youtube-resolver.ts` (resolveUrl), `music/youtube-data-api/index.ts` (fetch) — keep existing log message strings.
- [ ] 2.1 In `music/play.ts` init args, add `--cache=yes`, `--cache-pause=yes` (currently forced `no`), `--network-timeout=15`, `--stream-lavf-o=reconnect=1,reconnect_streamed=1,reconnect_delay_max=5`.
- [ ] 3.1 In `music/play.ts` `handleEndFile`, on `reason === 4` classify transient vs permanent via `mpvError(errorCode)`; save `{ videoId, timePos, wasPlaying }`.
- [ ] 3.2 On transient failure: re-resolve with `resolveStreamUrl`, `loadfile`, `seek` back to saved `timePos`; backoff 1s → 2s → 4s → 8s, cap ~60s; emit new `player-retrying` event instead of `ended`.
- [ ] 3.3 After cap exhausted, emit `track-error`; in `src/bun/index.ts` keep transient-failed tracks in `playedTrack` (only drop on `isPermanentUnavailable`).
- [ ] 4.1 Add `src/bun/lib/network.ts` — cheap on-demand probe (`getNetworkState()`), active only while a failure is outstanding; `Player` resumes parked retries when state flips to online.
- [ ] 5.1 Unify session refresh into `ytSession.invalidateAndEnsure()` (also resets resolver `ready`); use from both `music/youtube/index.ts` and `music/youtube-resolver.ts`.
- [ ] 5.2 Add `network-retry` / `network-restored` events to `src/shared/types.ts` and surface a "reconnecting…" state in WinUI + Avalonia instead of an error toast.
- [ ] 6.1 Verify: `bun run typecheck`; manually pull the network adapter mid-track and confirm playback resumes instead of skipping.
