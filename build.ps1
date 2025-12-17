#!/usr/bin/env pwsh
<#
.SYNOPSIS
    一键构建 AI Render Panel 插件
.DESCRIPTION
    构建前端 (React) 和后端 (C#)，并将所有文件复制到 dist 目录
.EXAMPLE
    .\build.ps1
    .\build.ps1 -Release
    .\build.ps1 -Clean
#>

param(
    [switch]$Release,    # 构建 Release 版本（默认 Debug）
    [switch]$Clean,      # 清理构建产物
    [switch]$SkipFrontend  # 跳过前端构建
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$DistDir = Join-Path $ProjectRoot "dist"
$WebUiDir = Join-Path $ProjectRoot "src/web-ui"
$PluginDir = Join-Path $ProjectRoot "src/AIRenderPanel"
$Configuration = if ($Release) { "Release" } else { "Debug" }

Write-Host "================================" -ForegroundColor Cyan
Write-Host " AI Render Panel 构建脚本" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "配置: $Configuration" -ForegroundColor Yellow

# 清理
if ($Clean) {
    Write-Host "`n[1/3] 清理构建产物..." -ForegroundColor Green
    
    if (Test-Path $DistDir) {
        Remove-Item -Recurse -Force $DistDir
        Write-Host "  已删除 dist/"
    }
    
    $binDirs = @(
        (Join-Path $PluginDir "bin"),
        (Join-Path $PluginDir "obj"),
        (Join-Path $WebUiDir "dist"),
        (Join-Path $WebUiDir "node_modules/.vite")
    )
    
    foreach ($dir in $binDirs) {
        if (Test-Path $dir) {
            Remove-Item -Recurse -Force $dir
            Write-Host "  已删除 $dir"
        }
    }
    
    Write-Host "清理完成!" -ForegroundColor Green
    exit 0
}

# 确保 dist 目录存在
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

# 构建前端
if (-not $SkipFrontend) {
    Write-Host "`n[1/3] 构建前端 (React)..." -ForegroundColor Green
    Push-Location $WebUiDir
    
    try {
        # 检查 node_modules
        if (-not (Test-Path "node_modules")) {
            Write-Host "  安装依赖..."
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }
        }
        
        Write-Host "  构建..."
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }
        
        Write-Host "  前端构建完成!" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "`n[1/3] 跳过前端构建" -ForegroundColor Gray
}

# 构建后端
Write-Host "`n[2/3] 构建后端 (C#)..." -ForegroundColor Green
Push-Location $PluginDir

try {
    dotnet build -c $Configuration
    if ($LASTEXITCODE -ne 0) { throw "dotnet build 失败" }
    
    Write-Host "  后端构建完成!" -ForegroundColor Green
}
finally {
    Pop-Location
}

# 复制到 dist
Write-Host "`n[3/3] 复制文件到 dist..." -ForegroundColor Green

$OutputDir = Join-Path $PluginDir "bin/$Configuration/net7.0-windows/win-x64"

# 主插件
$PluginDll = Join-Path $OutputDir "AIRenderPanel.dll"
$PluginRhp = Join-Path $DistDir "AIRenderPanel.rhp"
Copy-Item $PluginDll $PluginRhp -Force
Write-Host "  AIRenderPanel.rhp"

# 依赖 DLL
$Dependencies = @(
    "Microsoft.Web.WebView2.Core.dll",
    "Microsoft.Web.WebView2.WinForms.dll",
    "Microsoft.Web.WebView2.Wpf.dll",
    "WebView2Loader.dll",
    "Newtonsoft.Json.dll",
    "Eto.dll",
    "Eto.WinForms.dll",
    "Microsoft.WindowsAPICodePack.dll",
    "Microsoft.WindowsAPICodePack.Shell.dll"
)

foreach ($dll in $Dependencies) {
    $src = Join-Path $OutputDir $dll
    if (Test-Path $src) {
        Copy-Item $src $DistDir -Force
        Write-Host "  $dll"
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host " 构建完成!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "输出目录: $DistDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "安装步骤:" -ForegroundColor White
Write-Host "  1. 打开 Rhino 8"
Write-Host "  2. 运行命令 PlugInManager"
Write-Host "  3. 点击「安装」并选择 $PluginRhp"
Write-Host "  4. 重启 Rhino"
Write-Host ""
