; AI Render Panel 安装脚本
; 使用 Inno Setup 编译: https://jrsoftware.org/isinfo.php

#define MyAppName "AI Render Panel"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Your Studio"
#define MyAppURL "https://your-website.com"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\Rhino 8\Plug-ins\AIRenderPanel
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=installer
OutputBaseFilename=AIRenderPanel_Setup_{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

; 语言设置
[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; 插件主文件
Source: "dist\AIRenderPanel.rhp"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\AIRenderPanel.rui"; DestDir: "{app}"; Flags: ignoreversion
; Web UI 文件
Source: "dist\web-ui\*"; DestDir: "{app}\web-ui"; Flags: ignoreversion recursesubdirs createallsubdirs
; 依赖 DLL (如果有的话)
Source: "dist\*.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

[Code]
// 安装后自动注册插件到 Rhino
procedure RegisterRhinoPlugin();
var
  RegPath: string;
begin
  // Rhino 8 插件注册表路径
  RegPath := 'Software\McNeel\Rhinoceros\8.0\Plug-ins\{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}';
  
  // 写入注册表
  RegWriteStringValue(HKEY_CURRENT_USER, RegPath, 'Name', '{#MyAppName}');
  RegWriteStringValue(HKEY_CURRENT_USER, RegPath, 'FileName', ExpandConstant('{app}\AIRenderPanel.rhp'));
  RegWriteDWordValue(HKEY_CURRENT_USER, RegPath, 'Enabled', 1);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    RegisterRhinoPlugin();
  end;
end;

[Run]
; 安装完成后提示用户
Filename: "{cmd}"; Parameters: "/c echo 安装完成！请重启 Rhino 8 以加载插件。 && pause"; Description: "显示安装说明"; Flags: postinstall shellexec skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Messages]
WelcomeLabel2=这将安装 {#MyAppName} 插件到您的电脑。%n%n该插件用于在 Rhino 8 中使用 AI 进行渲染。%n%n点击"下一步"继续安装。
FinishedLabel=安装已完成。请重启 Rhino 8 以加载插件。%n%n使用方法：在 Rhino 中输入命令 AIRenderPanel
