# Incremental payload refresh used by launch.ts when the host restages the
# sandbox (bun run sandbox:run / sandbox:sync with an open window).
#
#   C:\KuumoStage  <- build\sandbox\stage   (read-only, freshly staged payload)
#   C:\KuumoDev                          (local payload the app runs from)
#
# /E instead of /MIR on purpose: the running interpreter (C:\KuumoDev\bun\bun.exe)
# and the executing launcher (scripts\launch.ts, scripts\sync.ps1) must never be
# touched, and /MIR would race them. Stale extras are pruned explicitly below,
# skipping the same protected paths. An exact mirror still happens on every boot
# (provision.ps1), so a --fresh run clears anything this leaves behind.
$ErrorActionPreference = "Stop"

$src = "C:\KuumoStage"
$dst = "C:\KuumoDev"

& robocopy $src $dst /E /XD bun /XF launch.ts sync.ps1 /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
$copyExit = $LASTEXITCODE
if ($copyExit -ge 8) {
    Write-Output "robocopy failed (exit $copyExit)"
    exit $copyExit
}

$removed = 0
Get-ChildItem -LiteralPath $dst -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($dst.Length)
    if ($rel -like "\bun\*") { return }
    if ($_.Name -eq "launch.ts" -or $_.Name -eq "sync.ps1") { return }
    if (-not (Test-Path -LiteralPath ($src + $rel))) {
        Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        $removed++
    }
}

Write-Output "payload synced (robocopy exit $copyExit, pruned $removed stale file(s))"
exit 0
