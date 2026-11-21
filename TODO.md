# Memory Optimization Plan for KuumoApp Tray Mode

## Phase 1: Pausing UI timers/progress updates when window is hidden
- [x] Identify all UI timers that should be paused when window is hidden (HomePage, SearchPage, PlayerBar)
- [x] Locate `DispatcherQueueTimer` usage in `HomePage.xaml.cs`, `SearchPage.xaml.cs`, `PlayerBar.xaml.cs`
- [x] Implement conditional logic to pause/resume timers based on `IsWindowVisible` state
- [x] Ensure time update events are only processed when window is visible

## Phase 2: Capping album art `DecodePixelWidth` & clearing transient visual caches on hide
- [x] Review `ImageAttach.cs` for default decode size (`DefaultDecodeSize = 200`)
- [x] Modified image decoding to use smaller dimensions when window is hidden (reduced from 200 to 100)
- [x] Confirmed `UiMemoryManager.cs` properly clears image cache on `OnWindowHidden()`
- [x] Verified `ImageCache.Clear()` is called appropriately during window hiding

## Phase 3: Safe GC + Win32 `EmptyWorkingSet` trim right after window hide
- [x] Examine `UiMemoryManager.cs` for existing memory trimming logic (confirmed working set trimming scheduled after window hide)
- [x] Confirm `MemoryTrimmer.TrimWorkingSet()` is called after window hide (called in ScheduleTrimAsync method with proper delay and background check)
- [x] Validate GC collection strategy in `MemoryTrimmer.cs` (uses aggressive GC collection with compaction and WaitForPendingFinalizers)
- [x] Check that `TrimWorkingSet()` is only called when truly in background mode (only called if window is still hidden and transitionGen matches)

## Phase 4: Tuning Bun / `libmpv` background demuxer/cache buffers
- [x] Review `play.ts` mpv options for background playback optimization
- [x] Locate `demuxer-readahead-secs` and `demuxer-max-bytes` settings (currently set to 5s and 8MB)
- [x] Reduced `demuxer-readahead-secs` from 5s to 2s and `demuxer-max-bytes` from 8MB to 4MB for background playback
- [x] Verified `cache-pause` option is properly utilized for background mode