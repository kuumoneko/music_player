# Downloads and installs .NET Desktop Runtime for the Avalonia app.
# Called by setup-avalonia.iss at install time; requires internet.
# Version pin must stay in sync with app-avalonia/KuumoApp/KuumoApp.csproj:
#   net10.0 -> .NET Desktop Runtime 10.0.x

$ErrorActionPreference = "Stop"

$DotnetVersion = "10.0.9"
$DotnetUrl = "https://dotnetcli.azureedge.net/dotnet/WindowsDesktop/$DotnetVersion/windowsdesktop-runtime-$DotnetVersion-win-x64.exe"

$tempRoot = Join-Path $env:TEMP "kuumo-prereq-avalonia"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

function Test-DotnetInstalled {
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

if (Test-DotnetInstalled) {
    Write-Output "SKIP .NET Desktop Runtime (>= $DotnetVersion installed)"
} else {
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

Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
Write-Output ".NET Desktop Runtime ready."
exit 0
