# Installs the Windows App SDK runtime MSIX packages (framework-dependent deployment)
# from files bundled with the installer — no network required.
#
# Expects this folder layout (assembled by scripts/package.ts):
#   MSIX.inventory                     short=full package mapping (x64 lines only)
#   <short-name>.msix                  the 4 x64 runtime packages

param(
    [string]$RuntimeDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

$inventory = Join-Path $RuntimeDir "MSIX.inventory"
if (-not (Test-Path -LiteralPath $inventory)) {
    Write-Error "MSIX.inventory not found in $RuntimeDir"
    exit 1
}

$packages = Get-Content -LiteralPath $inventory | ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Count -ne 2) { return }
    $fullParts = $parts[1] -split "_", 4
    [PSCustomObject]@{
        File    = $parts[0].Trim()
        Name    = $fullParts[0]
        Version = $fullParts[1]
        Arch    = $fullParts[2]
    }
}

foreach ($pkg in $packages) {
    $file = Join-Path $RuntimeDir $pkg.File
    if (-not (Test-Path -LiteralPath $file)) {
        Write-Error "Missing $($pkg.File) in $RuntimeDir"
        exit 1
    }

    $installed = Get-AppxPackage -Name $pkg.Name -ErrorAction SilentlyContinue |
        Where-Object { $_.Architecture -ieq $pkg.Arch -and $_.Version -ge [version]$pkg.Version }
    if ($installed) {
        Write-Output "SKIP $($pkg.Name) $($pkg.Version) (already installed)"
        continue
    }

    Write-Output "INSTALL $($pkg.File) ($($pkg.Name) $($pkg.Version))"
    try {
        Add-AppxPackage -Path $file -ErrorAction Stop
    } catch {
        $check = Get-AppxPackage -Name $pkg.Name -ErrorAction SilentlyContinue |
            Where-Object { $_.Version -ge [version]$pkg.Version }
        if (-not $check) {
            Write-Error "Failed to install $($pkg.File): $_"
            exit 1
        }
    }
}

Write-Output "Windows App SDK runtime ready."
exit 0
