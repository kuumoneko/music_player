# Runs inside Windows Sandbox at logon (LogonCommand from the .wsb generated
# by scripts/sandbox-prepare.ts). Installs cached runtime prerequisites, copies
# the staged payload to a writable local directory, and starts the dev
# launcher (scripts/launch.ts).
#
# Mapped folders (keep in sync with scripts/sandbox-prepare.ts):
#   C:\KuumoCache  <- build\sandbox\cache   (read-only, host-downloaded installers)
#   C:\KuumoStage  <- build\sandbox\stage   (read-only, staged payload)
#   C:\KuumoSync   <- build\sandbox\sync    (read-write, status handoff to host)
# Local payload: C:\KuumoDev

$ErrorActionPreference = "Stop"

$Host.UI.RawUI.WindowTitle = "KuumoApp Sandbox"

$cacheDir = "C:\KuumoCache"
$stageDir = "C:\KuumoStage"
$syncDir = "C:\KuumoSync"
$destDir = "C:\KuumoDev"

# Version pins must stay in sync with scripts/install-prereqs.ps1.
$DotnetVersion = "10.0.9"
$WasdkMinVersion = [version]"2.3.0"
$portableDotnetDir = "C:\KuumoDotnet"

$script:status = [ordered]@{
    startedAt = (Get-Date).ToString("o")
    steps     = @()
}
$script:startedTick = Get-Date

function Save-Status {
    # Flushed after every step so the host can watch progress live through
    # the read-write sync mapped folder.
    try {
        $script:status | ConvertTo-Json -Depth 4 |
            Set-Content -LiteralPath (Join-Path $syncDir "provision.json") -Encoding UTF8
    } catch { }
}

function Write-Step([string]$Message) {
    $stamp = (Get-Date).ToString("HH:mm:ss")
    $elapsed = "+{0:N1}s" -f ((Get-Date) - $script:startedTick).TotalSeconds
    Write-Host "[sandbox] [$stamp][$elapsed] $Message" -ForegroundColor Cyan
    $script:status["steps"] += "[$stamp][$elapsed] $Message"
    Save-Status
}

function Test-DotnetInstalled {
    $dotnet = Join-Path $env:ProgramFiles "dotnet\dotnet.exe"
    if (Test-Path $dotnet) {
        foreach ($line in & $dotnet --list-runtimes 2>$null) {
            if ($line -match "^Microsoft\.WindowsDesktop\.App\s+(\d+\.\d+\.\d+)" -and [version]$matches[1] -ge [version]$DotnetVersion) {
                return $true
            }
        }
    }
    return $false
}

function Install-DotnetRuntime {
    if (Test-DotnetInstalled) {
        Write-Step "SKIP .NET Desktop Runtime (>= $DotnetVersion installed)"
        return
    }

    # Preferred: portable zip(s) extracted to $portableDotnetDir (launch.ts
    # sets DOTNET_ROOT for the app) — the MSI takes ~8 minutes on a fresh
    # sandbox. The base runtime zip provides dotnet.exe + Microsoft.NETCore.App
    # (all both apps' runtimeconfigs request); a cached windowsdesktop-runtime
    # zip overlays the desktop shared framework if present.
    $zips = @(Get-ChildItem -LiteralPath $cacheDir -Filter "dotnet-runtime-*.zip" -ErrorAction SilentlyContinue) +
            @(Get-ChildItem -LiteralPath $cacheDir -Filter "windowsdesktop-runtime-*.zip" -ErrorAction SilentlyContinue)
    if ($zips.Count -gt 0) {
        $dotnetExe = Join-Path $portableDotnetDir "dotnet.exe"
        if (Test-Path -LiteralPath $dotnetExe) {
            Write-Step "SKIP .NET runtime (portable already extracted)"
            return
        }
        if (Test-Path -LiteralPath $portableDotnetDir) {
            Remove-Item -LiteralPath $portableDotnetDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $portableDotnetDir -Force | Out-Null
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        foreach ($zip in $zips) {
            Write-Step "EXTRACT .NET runtime portable ($($zip.Name))"
            [System.IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $portableDotnetDir)
        }
        if (-not (Test-Path -LiteralPath $dotnetExe)) {
            throw "dotnet.exe missing after portable extract: $dotnetExe"
        }
        Write-Step "DONE .NET runtime (portable: $portableDotnetDir)"
        return
    }

    $installer = Get-ChildItem -LiteralPath $cacheDir -Filter "windowsdesktop-runtime-*.exe" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $installer) {
        throw "No cached .NET Desktop Runtime (.zip preferred, .exe fallback) in $cacheDir (run 'bun run sandbox:prepare' on the host)."
    }
    Write-Step "INSTALL .NET Desktop Runtime $($installer.Name)"
    $proc = Start-Process -FilePath $installer.FullName -ArgumentList "/install", "/quiet", "/norestart" -Wait -PassThru
    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
        throw ".NET Desktop Runtime install failed (exit $($proc.ExitCode))"
    }
    Write-Step "DONE .NET Desktop Runtime"
}

function Get-MsixIdentity {
    param([string]$MsixPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($MsixPath)
    try {
        $entry = $archive.Entries | Where-Object { $_.FullName -eq "AppxManifest.xml" } | Select-Object -First 1
        if (-not $entry) { return $null }
        $reader = New-Object System.IO.StreamReader($entry.Open())
        try {
            [xml]$manifest = $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
        }
        return [PSCustomObject]@{
            Name    = $manifest.Package.Identity.Name
            Version = $manifest.Package.Identity.Version
            Arch    = $manifest.Package.Identity.ProcessorArchitecture
        }
    } finally {
        $archive.Dispose()
    }
}

function Install-WasdkRuntime {
    $packages = @(Get-AppxPackage -Name "Microsoft.WindowsAppRuntime*" -ErrorAction SilentlyContinue)
    $script:status["wasdkPackages"] = @($packages | ForEach-Object { "$($_.Name) $($_.Version)" })
    # Bootstrap needs exactly the Microsoft.WindowsAppRuntime.2 framework
    # package at >= 2.3. The inbox Microsoft.WindowsAppRuntime.CBS.* packages
    # carry versions like 6000.x, which fool a plain Version >= 2.3.0 check.
    $installed = $packages |
        Where-Object { $_.Name -eq "Microsoft.WindowsAppRuntime.2" -and $_.Version -ge $WasdkMinVersion }
    if ($installed) {
        Write-Step "SKIP Windows App SDK runtime (Microsoft.WindowsAppRuntime.2 >= 2.3 installed)"
        return
    }
    $zip = Join-Path $cacheDir "Microsoft.WindowsAppRuntime.Redist.2.3.zip"
    if (-not (Test-Path -LiteralPath $zip)) {
        throw "Cached Windows App SDK redist not found: $zip (run 'bun run sandbox:prepare' on the host)."
    }
    $extract = Join-Path $env:TEMP "kuumo-wasdk"
    if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    Write-Step "EXTRACT Windows App SDK runtime Redist 2.3 (from cache)"
    # Expand-Archive is PowerShell-only and very slow on this 474 MB archive;
    # the inbox bsdtar (tar.exe) does the same job in a fraction of the time.
    $tar = Join-Path $env:SystemRoot "System32\tar.exe"
    if (Test-Path -LiteralPath $tar) {
        & $tar -xf $zip -C $extract
        if ($LASTEXITCODE -ne 0) { throw "tar failed to extract the Windows App SDK redist (exit $LASTEXITCODE)" }
    } else {
        Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
    }

    # The 2.3 Redist archive serves the x64 framework packages under MSIX/win10-x64/.
    $msixes = Get-ChildItem -LiteralPath $extract -Recurse -Filter "*.msix" |
        Where-Object { $_.FullName -match "win10-x64" }
    if ($msixes.Count -eq 0) {
        throw "No win10-x64 MSIX packages found in the Windows App SDK Redist archive."
    }

    foreach ($msix in $msixes) {
        $identity = Get-MsixIdentity $msix.FullName
        if (-not $identity) {
            throw "Failed to read AppxManifest.xml from $($msix.Name)."
        }
        $present = Get-AppxPackage -Name $identity.Name -ErrorAction SilentlyContinue |
            Where-Object { $_.Architecture -ieq $identity.Arch -and $_.Version -ge [version]$identity.Version }
        if ($present) {
            Write-Step "SKIP $($identity.Name) $($identity.Version) (already installed)"
            continue
        }
        Write-Step "INSTALL $($identity.Name) $($identity.Version)"
        try {
            Add-AppxPackage -Path $msix.FullName -ErrorAction Stop
        } catch {
            $check = Get-AppxPackage -Name $identity.Name -ErrorAction SilentlyContinue |
                Where-Object { $_.Version -ge [version]$identity.Version }
            if (-not $check) {
                throw "Failed to install $($identity.Name): $_"
            }
        }
    }
}

try {
    # Before any payload lands on disk: Defender otherwise scans the ~240 MB
    # copy and the app's first launch, which used to cost tens of seconds. The
    # guest is disposable, so excluding the working dirs is safe.
    Write-Step "adding Defender exclusions for the sandbox payload dirs"
    try {
        Add-MpPreference -ExclusionPath @($destDir, $stageDir, $syncDir, $cacheDir, "C:\KuumoDotnet") -ErrorAction Stop
        Write-Step "Defender exclusions added"
    } catch {
        Write-Step "SKIP Defender exclusions ($($_.Exception.Message))"
    }

    Write-Step "copying staged payload to $destDir"
    $null = robocopy $stageDir $destDir /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:2
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }
    $global:LASTEXITCODE = 0

    Install-DotnetRuntime

    # Avalonia never uses the Windows App SDK - skipping saves the 474 MB
    # extract plus the MSIX deploy when the session has no WinUI payload.
    $stageTarget = "both"
    $metaPath = Join-Path $stageDir "sandbox.json"
    if (Test-Path -LiteralPath $metaPath) {
        try { $stageTarget = (Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json).target } catch { }
    }
    if ($stageTarget -eq "avalonia") {
        Write-Step "SKIP Windows App SDK runtime (target=avalonia - no WinUI payload)"
    } else {
        Install-WasdkRuntime
    }

    $bunExe = Join-Path $destDir "bun\bun.exe"
    $launcher = Join-Path $destDir "scripts\launch.ts"
    if (-not (Test-Path -LiteralPath $bunExe)) { throw "bun.exe not found: $bunExe" }
    if (-not (Test-Path -LiteralPath $launcher)) { throw "launcher not found: $launcher" }

    Write-Step "starting dev launcher (watch this window for status)"
    & $bunExe $launcher
    $script:status["result"] = "ok"
    $script:status["exitCode"] = $LASTEXITCODE
    exit $LASTEXITCODE
} catch {
    $script:status["result"] = "error"
    $script:status["error"] = $_.Exception.Message
    Write-Host "[sandbox] ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    $script:status["finishedAt"] = (Get-Date).ToString("o")
    Save-Status
}
