param(
    [string]$HermesAgentPath = "$PSScriptRoot\..\..\hermes-agent"
)

$ErrorActionPreference = "Stop"
$BrandPrefix = "[Ufren Hermes Desktop]"

function Write-AssetLog {
    param([string]$Message)
    Write-Output "$BrandPrefix $Message"
}

$webDistPath = Join-Path $HermesAgentPath "hermes_cli\web_dist"
$frontendIndexPath = Join-Path $webDistPath "index.html"
$webSourcePath = Join-Path $HermesAgentPath "web"
$packageJsonPath = Join-Path $webSourcePath "package.json"
$packageLockPath = Join-Path $webSourcePath "package-lock.json"
if (-not (Test-Path -LiteralPath $packageJsonPath)) {
    throw "$BrandPrefix Dashboard frontend sources not found: $webSourcePath"
}

$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if ($null -eq $npmCommand) {
    throw "$BrandPrefix Dashboard frontend assets are missing and npm is not available to build them"
}

if (Test-Path -LiteralPath $webDistPath) {
    Write-AssetLog "Removing existing dashboard frontend assets before rebuild"
    Remove-Item -LiteralPath $webDistPath -Recurse -Force
}

Write-AssetLog "Rebuilding dashboard frontend assets for packaging"
Push-Location $webSourcePath
try {
    if (Test-Path -LiteralPath $packageLockPath) {
        & $npmCommand.Source ci --silent
    } else {
        & $npmCommand.Source install --silent
    }
    if ($LASTEXITCODE -ne 0) {
        throw "$BrandPrefix npm dependency installation failed while building dashboard frontend assets"
    }

    & $npmCommand.Source run build --silent
    if ($LASTEXITCODE -ne 0) {
        throw "$BrandPrefix npm run build failed while building dashboard frontend assets"
    }
} finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $frontendIndexPath)) {
    throw "$BrandPrefix Dashboard frontend build completed without generating $frontendIndexPath"
}

Write-AssetLog "Dashboard frontend assets built"
