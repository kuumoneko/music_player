# Downloads and installs the runtime prerequisites for a framework-dependent
# Windows App SDK app — .NET Desktop Runtime + Windows App SDK runtime MSIX
# packages. Called by setup.iss at install time; requires internet.
#
# Version pins below must stay in sync with KuumoApp.csproj:
#   net10.0                    -> .NET Desktop Runtime 10.0.x
#   Microsoft.WindowsAppSDK 2.3.1 -> WindowsAppRuntime Redist 2.3
#   Program.cs bootstrap 0x00020003

$ErrorActionPreference = "Stop"

$DotnetVersion = "10.0.9"
$DotnetUrl = "https://dotnetcli.azureedge.net/dotnet/WindowsDesktop/$DotnetVersion/windowsdesktop-runtime-$DotnetVersion-win-x64.exe"
$WasdkRedistUrl = "https://aka.ms/windowsappsdk/2.3/2.3.1/Microsoft.WindowsAppRuntime.Redist.2.3.zip"

$tempRoot = Join-Path $env:TEMP "kuumo-prereq"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

function Test-DotnetInstalled {
    # Most reliable: ask dotnet itself (covers sharedhost/sharedfx layouts and
    # per-user installs). Registry fallbacks for non-PATH machines.
    $dotnet = Join-Path $env:ProgramFiles "dotnet\dotnet.exe"
    if (Test-Path $dotnet) {
        foreach ($line in & $dotnet --list-runtimes 2>$null) {
            if ($line -match "^Microsoft\.WindowsDesktop\.App\s+(\d+\.\d+\.\d+)" -and [version]$matches[1] -ge [version]$DotnetVersion) {
                return $true
            }
        }
    }
    foreach ($regPath in @(
        "HKLM:\SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App",
        "HKCU:\SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App"
    )) {
        $installed = Get-ItemProperty $regPath -ErrorAction SilentlyContinue
        if (-not $installed) { continue }
        foreach ($v in $installed.PSObject.Properties.Value) {
            if ($v -as [version] -and [version]$v -ge [version]$DotnetVersion) {
                return $true
            }
        }
    }
    return $false
}

function Install-DotnetRuntime {
    if (Test-DotnetInstalled) {
        Write-Output "SKIP .NET Desktop Runtime (>= $DotnetVersion installed)"
        return
    }

    Write-Output "DOWNLOAD .NET Desktop Runtime $DotnetVersion ..."
    $exe = Join-Path $tempRoot "windowsdesktop-runtime-$DotnetVersion-win-x64.exe"
    try {
        Invoke-WebRequest -Uri $DotnetUrl -OutFile $exe -UseBasicParsing
    } catch {
        Write-Error "Failed to download .NET Desktop Runtime: $_"
        exit 1
    }

    Write-Output "INSTALL .NET Desktop Runtime $DotnetVersion ..."
    $proc = Start-Process -FilePath $exe -ArgumentList "/install", "/quiet", "/norestart" -Wait -PassThru
    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
        Write-Error "Failed to install .NET Desktop Runtime (exit $($proc.ExitCode))"
        exit 1
    }
    Remove-Item -LiteralPath $exe -Force -ErrorAction SilentlyContinue
    Write-Output "DONE .NET Desktop Runtime"
}

function Install-WasdkRuntime {
    $installed = Get-AppxPackage -Name "Microsoft.WindowsAppRuntime*" -ErrorAction SilentlyContinue |
        Where-Object { $_.Version -ge [version]"2.3.0" }
    if ($installed) {
        Write-Output "SKIP Windows App SDK runtime (>= 2.3.0 installed)"
        return
    }

    Write-Output "DOWNLOAD Windows App SDK runtime Redist 2.3 ..."
    $zip = Join-Path $tempRoot "Microsoft.WindowsAppRuntime.Redist.2.3.zip"
    $extract = Join-Path $tempRoot "redist"
    try {
        Invoke-WebRequest -Uri $WasdkRedistUrl -OutFile $zip -UseBasicParsing
        if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
        Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
    } catch {
        Write-Error "Failed to download/extract Windows App SDK runtime: $_"
        exit 1
    }

    # The 2.3 Redist archive serves the x64 framework packages directly under
    # MSIX/win10-x64/ (no MSIX.inventory since the 2.3.1 refresh).
    $msixes = Get-ChildItem -LiteralPath $extract -Recurse -Filter "*.msix" |
        Where-Object { $_.FullName -match "win10-x64" }

    if ($msixes.Count -eq 0) {
        Write-Error "No win10-x64 MSIX packages found in the Windows App SDK Redist archive."
        exit 1
    }

    foreach ($msix in $msixes) {
        $identity = Get-MsixIdentity $msix.FullName
        if (-not $identity) {
            Write-Error "Failed to read AppxManifest.xml from $($msix.Name)."
            exit 1
        }

        $installed = Get-AppxPackage -Name $identity.Name -ErrorAction SilentlyContinue |
            Where-Object { $_.Architecture -ieq $identity.Arch -and $_.Version -ge [version]$identity.Version }
        if ($installed) {
            Write-Output "SKIP $($identity.Name) $($identity.Version) (already installed)"
            continue
        }

        Write-Output "INSTALL $($identity.Name) $($identity.Version) ..."
        try {
            Add-AppxPackage -Path $msix.FullName -ErrorAction Stop
        } catch {
            $check = Get-AppxPackage -Name $identity.Name -ErrorAction SilentlyContinue |
                Where-Object { $_.Version -ge [version]$identity.Version }
            if (-not $check) {
                Write-Error "Failed to install $($identity.Name): $_"
                exit 1
            }
        }
    }
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

Install-DotnetRuntime
Install-WasdkRuntime

Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "Runtime prerequisites ready."
exit 0
