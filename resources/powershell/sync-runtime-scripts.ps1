param(
    [string]$Distribution = "Ubuntu",
    [string]$RuntimeScriptsRoot = "~/.local/share/ufren-hermes/runtime/scripts",
    [string]$SourceWindowsPath = "$PSScriptRoot\..\wsl"
)

$ErrorActionPreference = "Stop"
$BrandPrefix = "[Ufren Hermes Desktop]"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

if (-not (Test-Path -LiteralPath $SourceWindowsPath)) {
    throw "$BrandPrefix WSL script source not found: $SourceWindowsPath"
}

$env:UFREN_SOURCE_WIN = $SourceWindowsPath
if ([string]::IsNullOrEmpty($env:WSLENV)) {
    $env:WSLENV = "UFREN_SOURCE_WIN/p"
} else {
    $env:WSLENV = "$env:WSLENV:UFREN_SOURCE_WIN/p"
}

$ResolvedRuntimeScriptsRoot = $RuntimeScriptsRoot
if ($ResolvedRuntimeScriptsRoot.StartsWith("~/")) {
    $ResolvedRuntimeScriptsRoot = "`$HOME/" + $ResolvedRuntimeScriptsRoot.Substring(2)
}

$BashCommand = @"
set -euo pipefail

mkdir -p "$ResolvedRuntimeScriptsRoot"
cp -f "`$UFREN_SOURCE_WIN"/*.sh "$ResolvedRuntimeScriptsRoot/"
chmod +x "$ResolvedRuntimeScriptsRoot/"*.sh
"@
$BashCommand = $BashCommand -replace "`r`n", "`n"

$PreviousErrorActionPreference = $ErrorActionPreference
$PreviousNativePreference = $null
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PreviousNativePreference = $PSNativeCommandUseErrorActionPreference
    $global:PSNativeCommandUseErrorActionPreference = $false
}

try {
    $ErrorActionPreference = "Continue"
    $WslOutput = @(wsl -d $Distribution -- bash -lc $BashCommand 2>&1)
    $WslExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
    if ($null -ne $PreviousNativePreference) {
        $global:PSNativeCommandUseErrorActionPreference = $PreviousNativePreference
    }
}

foreach ($Entry in $WslOutput) {
    $Line = if ($Entry -is [System.Management.Automation.ErrorRecord]) {
        $Entry.ToString()
    } else {
        [string]$Entry
    }
    if (-not [string]::IsNullOrWhiteSpace($Line)) {
        Write-Output "$BrandPrefix [WSL] $Line"
    }
}

if ($WslExitCode -ne 0) {
    [Console]::Error.WriteLine(("{0} Runtime script sync failed with exit code {1}" -f $BrandPrefix, $WslExitCode))
    exit $WslExitCode
}

Write-Output "$BrandPrefix Runtime shell scripts synchronized for $Distribution"
