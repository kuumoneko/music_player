; KuumoApp installer — compile with: ISCC.exe setup.iss /DMyAppVersion=<version>
; Staging payload expected at: build\package\

#ifndef MyAppVersion
  #define MyAppVersion "6.0.0"
#endif

#ifndef MyAppBaseName
  #define MyAppBaseName "kuumoapp_{#MyAppVersion}-setup"
#endif

#define MyAppName "KuumoApp"
#define MyAppPublisher "kuumoneko"
#define MyAppExeName "KuumoApp.exe"

[Setup]
AppId={{A8E3B8A9-9B93-4C9A-8E5D-KUUMOAPP0001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\KuumoApp
DefaultGroupName={#MyAppName}
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=artifacts/
OutputBaseFilename={#MyAppBaseName}
Compression=lzma2/normal
SolidCompression=yes
LZMANumBlockThreads=4
LZMAUseSeparateProcess=yes
WizardStyle=modern
WizardSizePercent=110
SetupIconFile=app-winui\KuumoApp\Assets\AppIcon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
LicenseFile=
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[InstallDelete]
; Clean install: wipe the entire {app} dir before copying new files.
; User data at %APPDATA%\KuumoApp is untouched.
Type: filesandordirs; Name: "{app}"

[Registry]
; QuietUninstallString for silent uninstall from Settings/CLI
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Uninstall\{{A8E3B8A9-9B93-4C9A-8E5D-KUUMOAPP0001}_is1"; ValueType: string; ValueName: "QuietUninstallString"; ValueData: """{app}\unins000.exe"" /SILENT"; Flags: uninsdeletekey

[Files]
Source: "build\package\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Runtime prerequisite installer script (downloads .NET + Windows App SDK runtime)
Source: "scripts\install-prereqs.ps1"; DestDir: "{tmp}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; AppUserModelID: "kuumo.app"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; AppUserModelID: "kuumo.app"

[Run]
; 1) Runtime prerequisites: .NET Desktop Runtime + Windows App SDK runtime
;    (downloaded and installed by install-prereqs.ps1; requires internet)
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{tmp}\install-prereqs.ps1"""; StatusMsg: "Installing runtime prerequisites..."; Flags: waituntilterminated
; 2) Seed app data, then launch
Filename: "{app}\app\bun.exe"; Parameters: "{app}\app\backend\index.js --seed --data-dir ""{userappdata}\KuumoApp"" --assets ""{app}\app"""; StatusMsg: "Configuring app data..."; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
