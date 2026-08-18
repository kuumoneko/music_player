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
; Managed DLLs that used to sit at the app root in old layouts; new installs
; ship them inside app\ (payload). Remove the stale root copies.
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
; Old flat-layout installs kept the whole payload at the app root; it now
; lives in app\ (root holds only the launcher + uninstaller). Purge the stale
; files on upgrade so the root stays clean.
Type: filesandordirs; Name: "{app}\include"
Type: filesandordirs; Name: "{app}\Assets"
Type: filesandordirs; Name: "{app}\data"
Type: files; Name: "{app}\backend.exe"
Type: files; Name: "{app}\KuumoApp.dll"
Type: files; Name: "{app}\KuumoApp.pri"
Type: files; Name: "{app}\KuumoApp.deps.json"
Type: files; Name: "{app}\KuumoApp.runtimeconfig.json"
; Old WinUI satellite resource folders from self-contained installs (any locale
; format: en-US, fil-PH, az-Latn-AZ, ...). The framework-dependent build ships
; no .mui files; localized resources come from the runtime package.
Type: files; Name: "{app}\*\*.mui"
Type: dirifempty; Name: "{app}\*"
; Unused WASDK files (no code references) removed from include\ — keep in sync
; with PUBLISH_TRIM in scripts/package.ts. Microsoft.InteractiveExperiences.Projection.dll
; is NOT listed: unpackaged WinUI needs it at XAML startup.
Type: files; Name: "{app}\include\onnxruntime.dll"
Type: files; Name: "{app}\include\DirectML.dll"
Type: files; Name: "{app}\include\Microsoft.ML.OnnxRuntime.dll"
Type: files; Name: "{app}\include\System.Numerics.Tensors.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.MachineLearning.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.ContentSafety.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.Foundation.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.Imaging.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.MachineLearning.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.Text.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AI.Video.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.Widgets.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AppNotifications.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AppNotifications.Builder.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.PushNotifications.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.BadgeNotifications.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.Media.Capture.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.Management.Deployment.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.Security.AccessControl.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.ApplicationModel.Background.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.ApplicationModel.Background.UniversalBGTask.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.ApplicationModel.WindowsAppRuntime.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.AppLifecycle.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.System.Power.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.System.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.Storage.Pickers.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.Storage.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Graphics.Imaging.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Web.WebView2.Core.dll"
Type: files; Name: "{app}\include\Microsoft.Web.WebView2.Core.Projection.dll"
Type: files; Name: "{app}\include\WebView2Loader.dll"
; Old include\ layout (pre-flat installs) staged these at {app}\include\; the
; flat layout ships them at the app root. Remove the stale copies — only the
; backend's dlopen libs (avcodec/avformat/avutil/swresample/libmpv/libssp)
; remain in include\.
Type: files; Name: "{app}\include\CommunityToolkit.Mvvm.dll"
Type: files; Name: "{app}\include\H.GeneratedIcons.System.Drawing.dll"
Type: files; Name: "{app}\include\H.NotifyIcon.dll"
Type: files; Name: "{app}\include\H.NotifyIcon.WinUI.dll"
Type: files; Name: "{app}\include\Microsoft.Security.Authentication.OAuth.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Win32.SystemEvents.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.ApplicationModel.DynamicDependency.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.ApplicationModel.Resources.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.Foundation.Projection.dll"
Type: files; Name: "{app}\include\Microsoft.Windows.SDK.NET.dll"
Type: files; Name: "{app}\include\Microsoft.WindowsAppRuntime.Bootstrap.dll"
Type: files; Name: "{app}\include\Microsoft.WindowsAppRuntime.Bootstrap.Net.dll"
Type: files; Name: "{app}\include\Microsoft.WinUI.dll"
Type: files; Name: "{app}\include\System.Drawing.Common.dll"
Type: files; Name: "{app}\include\WinRT.Runtime.dll"

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
Filename: "{app}\app\backend.exe"; Parameters: "--seed --data-dir ""{userappdata}\KuumoApp"" --assets ""{app}\app"""; StatusMsg: "Configuring app data..."; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent