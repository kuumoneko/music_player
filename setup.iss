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
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=110
SetupIconFile=assets\favicon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
LicenseFile=
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[InstallDelete]
; Remove the old self-contained Windows App SDK payload (pre-6.1 installs).
; All patterns only match names that the new build keeps inside include\ or
; does not ship at all, so they can never touch the new payload.
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
; Managed DLLs that moved to include\ (Program.cs redirects loading there)
Type: files; Name: "{app}\CommunityToolkit.Mvvm.dll"
Type: files; Name: "{app}\H.NotifyIcon.dll"
Type: files; Name: "{app}\H.NotifyIcon.WinUI.dll"
Type: files; Name: "{app}\H.GeneratedIcons.System.Drawing.dll"
Type: files; Name: "{app}\System.Drawing.Common.dll"
Type: files; Name: "{app}\WinRT.Runtime.dll"
; Old WinUI runtime assets — framework-dependent builds get them from the runtime package
Type: filesandordirs; Name: "{app}\Microsoft.UI.Xaml"
Type: files; Name: "{app}\PerceptiveStreaming.dll"
Type: files; Name: "{app}\SessionHandleIPCProxyStub.dll"
Type: files; Name: "{app}\System.Numerics.Tensors.dll"
Type: files; Name: "{app}\workloads*.json"
Type: files; Name: "{app}\KuumoApp.pdb"
; Old locale satellite folders — the only "xx-XX"-shaped dirs ever at root
Type: filesandordirs; Name: "{app}\??-??"

[Files]
Source: "build\package\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Runtime prerequisites (installed by [Run] below, app is ready after install)
Source: "build\runtime-installer\windowsdesktop-runtime-10.0.9-win-x64.exe"; DestDir: "{tmp}\prereq"
Source: "build\runtime-installer\runtime\*"; DestDir: "{tmp}\prereq\runtime"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; AppUserModelID: "kuumo.app"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; AppUserModelID: "kuumo.app"

[Run]
; 1) .NET Desktop Runtime (app is .NET framework-dependent; pinned to 10.0.9)
Filename: "{tmp}\prereq\windowsdesktop-runtime-10.0.9-win-x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing .NET Desktop Runtime..."; Flags: waituntilterminated
; 2) Windows App SDK runtime, offline from the bundled MSIX packages
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{tmp}\prereq\runtime\install-runtime.ps1"""; StatusMsg: "Installing Windows App SDK Runtime..."; Flags: runhidden waituntilterminated
; 3) Seed app data, then launch
Filename: "{app}\backend.exe"; Parameters: "--seed --data-dir ""{userappdata}\KuumoApp"" --assets {app}"; StatusMsg: "Configuring app data..."; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent