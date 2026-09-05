; KuumoApp (Avalonia) installer — compile with: ISCC.exe setup-avalonia.iss /DMyAppVersion=<version>
; Staging payload expected at: build\avalonia-package\

#ifndef MyAppVersion
  #define MyAppVersion "6.0.0"
#endif

#ifndef MyAppBaseName
  #define MyAppBaseName "kuumoapp-avalonia_{#MyAppVersion}-setup"
#endif

#define MyAppName "KuumoApp"
#define MyAppPublisher "kuumoneko"
#define MyAppExeName "KuumoApp.exe"

[Setup]
AppId={{B7D4E2F1-3A8C-4D5E-9F1A-KUUMOAVA0001}
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
Compression=zip
SolidCompression=no
WizardStyle=modern
WizardSizePercent=110
SetupIconFile=app-avalonia\KuumoApp\Assets\AppIcon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
LicenseFile=
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[InstallDelete]
; Remove stale WinUI/WASDK files left by previous installs that shared the
; same install directory. Only touches files the Avalonia payload never ships.
Type: files; Name: "{app}\Microsoft.*"
Type: files; Name: "{app}\CoreMessagingXP.dll"
Type: files; Name: "{app}\dcompi.dll"
Type: files; Name: "{app}\dwmcorei.dll"
Type: files; Name: "{app}\DwmSceneI.dll"
Type: files; Name: "{app}\DWriteCore.dll"
Type: files; Name: "{app}\marshal.dll"
Type: files; Name: "{app}\MRM.dll"
Type: files; Name: "{app}\wuceffectsi.dll"
Type: files; Name: "{app}\WinUIEdit.dll"
Type: files; Name: "{app}\WebView2Loader.dll"
Type: files; Name: "{app}\RestartAgent.exe"
Type: files; Name: "{app}\DirectML.dll"
Type: files; Name: "{app}\onnxruntime.dll"
Type: files; Name: "{app}\Microsoft.ML.OnnxRuntime.dll"
Type: files; Name: "{app}\NPUDetect.dll"
Type: files; Name: "{app}\CommunityToolkit.Mvvm.dll"
Type: files; Name: "{app}\H.NotifyIcon.dll"
Type: files; Name: "{app}\H.NotifyIcon.WinUI.dll"
Type: files; Name: "{app}\H.GeneratedIcons.System.Drawing.dll"
Type: files; Name: "{app}\System.Drawing.Common.dll"
Type: files; Name: "{app}\WinRT.Runtime.dll"
Type: filesandordirs; Name: "{app}\Microsoft.UI.Xaml"
Type: files; Name: "{app}\PerceptiveStreaming.dll"
Type: files; Name: "{app}\SessionHandleIPCProxyStub.dll"
Type: files; Name: "{app}\System.Numerics.Tensors.dll"
Type: files; Name: "{app}\workloads*.json"
Type: files; Name: "{app}\KuumoApp.pdb"
; Old flat-layout installs kept files at the app root; new Avalonia layout
; also uses the root but without WinUI/WASDK DLLs. Clean up stale ones.
Type: files; Name: "{app}\KuumoApp.dll"
Type: files; Name: "{app}\KuumoApp.pri"
Type: files; Name: "{app}\KuumoApp.deps.json"
Type: files; Name: "{app}\KuumoApp.runtimeconfig.json"
Type: files; Name: "{app}\backend.exe"
; Old subfolder layouts (WinUI app\ payload)
Type: filesandordirs; Name: "{app}\app"
; Old satellite resource folders
Type: files; Name: "{app}\*\*.mui"
Type: dirifempty; Name: "{app}\*"

[Files]
Source: "build\avalonia-package\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; .NET Desktop Runtime prerequisite installer
Source: "scripts\install-prereqs-avalonia.ps1"; DestDir: "{tmp}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; AppUserModelID: "KuumoApp"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; AppUserModelID: "KuumoApp"

[Run]
; 1) Runtime prerequisite: .NET Desktop Runtime only (no WASDK)
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{tmp}\install-prereqs-avalonia.ps1"""; StatusMsg: "Installing .NET Desktop Runtime..."; Flags: waituntilterminated
; 2) Seed app data, then launch
Filename: "{app}\bun.exe"; Parameters: "{app}\backend\index.js --seed --data-dir ""{userappdata}\KuumoApp"" --assets ""{app}"""; StatusMsg: "Configuring app data..."; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
