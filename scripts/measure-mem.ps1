param(
    [string]$AppName = "KuumoApp",
    [string]$BackendNames = "bun,backend",
    [int]$Samples = 5,
    [int]$IntervalMs = 1000
)

$ErrorActionPreference = "Stop"

function Get-ChildProcessIds([int]$ParentId) {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        $child.ProcessId
        Get-ChildProcessIds $child.ProcessId
    }
}

$app = Get-Process -Name $AppName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" -or $_.ProcessName -eq $AppName } | Select-Object -First 1
if (-not $app) {
    Write-Error "KuumoApp process not found. Start the app first."
    return
}

$appId = $app.Id
$backendIds = Get-ChildProcessIds $appId
$backendNames = $BackendNames.Split(",")

$all = @($app) + (Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Id -in $backendIds -and $_.ProcessName -in $backendNames
})

if ($all.Count -lt 2) {
    Write-Warning "Backend child process not found via parent chain; falling back to name match."
    $all = @($app) + (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -in $backendNames })
}

Write-Host "Measuring $($all.Count) process(es):" -ForegroundColor Cyan
foreach ($p in $all) {
    Write-Host ("  PID {0,-7} {1}" -f $p.Id, $p.ProcessName)
}
Write-Host ""

$rows = @()
for ($i = 0; $i -lt $Samples; $i++) {
    Start-Sleep -Milliseconds $IntervalMs
    $totalPrivate = 0.0
    $totalWs = 0.0
    foreach ($p in $all) {
        $p.Refresh()
        $totalPrivate += $p.PrivateMemorySize64
        $totalWs += $p.WorkingSet64
    }
    $rows += [PSCustomObject]@{
        Sample      = $i + 1
        PrivateMB   = [math]::Round($totalPrivate / 1MB, 1)
        WorkingSetMB = [math]::Round($totalWs / 1MB, 1)
    }
}

$rows | Format-Table -AutoSize

$avgPrivate = ($rows | Measure-Object PrivateMB -Average).Average
$avgWs = ($rows | Measure-Object WorkingSetMB -Average).Average
$minPrivate = ($rows | Measure-Object PrivateMB -Minimum).Minimum
$minWs = ($rows | Measure-Object WorkingSetMB -Minimum).Minimum

Write-Host ""
Write-Host ("Combined private bytes:   avg {0,7:F1} MB   min {1,7:F1} MB" -f $avgPrivate, $minPrivate) -ForegroundColor Green
Write-Host ("Combined working set:     avg {0,7:F1} MB   min {1,7:F1} MB" -f $avgWs, $minWs) -ForegroundColor Green

Write-Host ""
Write-Host "Per-process breakdown (last sample):" -ForegroundColor Cyan
foreach ($p in $all) {
    $p.Refresh()
    Write-Host ("  {0,-12} private {1,8:F1} MB   ws {2,8:F1} MB" -f $p.ProcessName, ($p.PrivateMemorySize64 / 1MB), ($p.WorkingSet64 / 1MB))
}