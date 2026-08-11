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

function Install-DotnetRuntime {
    $installed = Get-ItemProperty "HKLM:\SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedfx\Microsoft.WindowsDesktop.App" -ErrorAction SilentlyContinue
    if ($installed) {
        foreach ($v in $installed.PSObject.Properties.Value) {
            if ($v -as [version] -and [version]$v -ge [version]$DotnetVersion) {
                Write-Output "SKIP .NET Desktop Runtime (>= $DotnetVersion installed: $v)"
                return
            }
        }
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

    $inventory = Get-ChildItem -LiteralPath $extract -Recurse -Filter "MSIX.inventory" | Select-Object -First 1
    if (-not $inventory) {
        Write-Error "MSIX.inventory not found in the Windows App SDK Redist archive."
        exit 1
    }

    $packages = Get-Content -LiteralPath $inventory.FullName | ForEach-Object {
        $parts = $_ -split "=", 2
        if ($parts.Count -ne 2) { return }
        $fullParts = $parts[1] -split "_", 4
        if ($fullParts.Count -ne 4) { return }
        [PSCustomObject]@{
            File    = $parts[0].Trim()
            Name    = $fullParts[0]
            Version = $fullParts[1]
            Arch    = $fullParts[2]
        }
    } | Where-Object { $_.Arch -eq "x64" }

    if ($packages.Count -eq 0) {
        Write-Error "No x64 MSIX entries found in the Windows App SDK Redist archive."
        exit 1
    }

    foreach ($pkg in $packages) {
        $file = Get-ChildItem -LiteralPath $extract -Recurse -Filter $pkg.File | Select-Object -First 1
        if (-not $file) {
            Write-Error "Missing $($pkg.File) in the Windows App SDK Redist archive."
            exit 1
        }

        $installed = Get-AppxPackage -Name $pkg.Name -ErrorAction SilentlyContinue |
            Where-Object { $_.Architecture -ieq $pkg.Arch -and $_.Version -ge [version]$pkg.Version }
        if ($installed) {
            Write-Output "SKIP $($pkg.Name) $($pkg.Version) (already installed)"
            continue
        }

        Write-Output "INSTALL $($pkg.Name) $($pkg.Version) ..."
        try {
            Add-AppxPackage -Path $file.FullName -ErrorAction Stop
        } catch {
            $check = Get-AppxPackage -Name $pkg.Name -ErrorAction SilentlyContinue |
                Where-Object { $_.Version -ge [version]$pkg.Version }
            if (-not $check) {
                Write-Error "Failed to install $($pkg.Name): $_"
                exit 1
            }
        }
    }
}

Install-DotnetRuntime
Install-WasdkRuntime

Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "Runtime prerequisites ready."
exit 0
