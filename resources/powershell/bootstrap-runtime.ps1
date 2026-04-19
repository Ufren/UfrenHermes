param(
    [string]$Distribution = "Ubuntu",
    [string]$RuntimeRoot = "~/.local/share/ufren-hermes/runtime",
    [string]$SourceWindowsPath = "$PSScriptRoot\..\wsl",
    [string]$AgentSourceWindowsPath = "$PSScriptRoot\..\hermes-agent"
)

$ErrorActionPreference = "Stop"
$BrandPrefix = "[Ufren Hermes Desktop]"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

function Write-BootstrapLog {
    param([string]$Message)
    Write-Output "$BrandPrefix $Message"
}

function Write-WslStreamLog {
    param(
        [string]$Content,
        [string]$StreamName = "stdout"
    )

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return
    }

    $Normalized = $Content -replace "`r`n", "`n" -replace "`r", "`n"
    foreach ($Line in ($Normalized -split "`n")) {
        if (-not [string]::IsNullOrWhiteSpace($Line)) {
            if ($StreamName -eq "stderr") {
                Write-BootstrapLog "[WSL][stderr] $Line"
            } else {
                Write-BootstrapLog "[WSL] $Line"
            }
        }
    }
}

function Ensure-HermesDashboardFrontend {
    param([string]$HermesAgentPath)

    $webDistPath = Join-Path $HermesAgentPath "hermes_cli\web_dist"
    $frontendIndexPath = Join-Path $webDistPath "index.html"
    if (Test-Path -LiteralPath $frontendIndexPath) {
        Write-BootstrapLog "Dashboard frontend build already present"
        return
    }

    $webSourcePath = Join-Path $HermesAgentPath "web"
    $packageJsonPath = Join-Path $webSourcePath "package.json"
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        throw "$BrandPrefix Dashboard frontend sources not found: $webSourcePath"
    }

    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
    if ($null -eq $npmCommand) {
        throw "$BrandPrefix Dashboard frontend is missing and npm is not available to build it"
    }

    Write-BootstrapLog "Building dashboard frontend assets"
    Push-Location $webSourcePath
    try {
        & $npmCommand.Source install --silent
        if ($LASTEXITCODE -ne 0) {
            throw "$BrandPrefix npm install failed while building dashboard frontend"
        }

        & $npmCommand.Source run build
        if ($LASTEXITCODE -ne 0) {
            throw "$BrandPrefix npm run build failed while building dashboard frontend"
        }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $frontendIndexPath)) {
        throw "$BrandPrefix Dashboard frontend build completed without generating $frontendIndexPath"
    }

    Write-BootstrapLog "Dashboard frontend assets built"
}

function Invoke-WslBashScript {
    param(
        [string]$BashCommand,
        [string]$User = ""
    )

    $PreviousErrorActionPreference = $ErrorActionPreference
    $PreviousNativePreference = $null
    if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
        $PreviousNativePreference = $PSNativeCommandUseErrorActionPreference
        $global:PSNativeCommandUseErrorActionPreference = $false
    }

    $WslArgs = @("-d", $Distribution)
    if (-not [string]::IsNullOrWhiteSpace($User)) {
        $WslArgs += @("-u", $User)
    }
    $WslArgs += @("--", "bash", "-s", "--")

    try {
        $ErrorActionPreference = "Continue"
        $WslOutput = @($BashCommand | & wsl @WslArgs 2>&1)
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
        Write-WslStreamLog -Content $Line -StreamName "stdout"
    }

    return $WslExitCode
}

if (-not (Test-Path -LiteralPath $SourceWindowsPath)) {
    throw "$BrandPrefix WSL script source not found: $SourceWindowsPath"
}
if (-not (Test-Path -LiteralPath $AgentSourceWindowsPath)) {
    throw "$BrandPrefix Hermes agent source not found: $AgentSourceWindowsPath"
}

Ensure-HermesDashboardFrontend -HermesAgentPath $AgentSourceWindowsPath

$env:UFREN_SOURCE_WIN = $SourceWindowsPath
$env:UFREN_AGENT_WIN = $AgentSourceWindowsPath
if ([string]::IsNullOrEmpty($env:WSLENV)) {
    $env:WSLENV = "UFREN_SOURCE_WIN/p:UFREN_AGENT_WIN/p"
} else {
    $env:WSLENV = "$env:WSLENV:UFREN_SOURCE_WIN/p:UFREN_AGENT_WIN/p"
}

# Resolve ~ to $HOME so that it expands correctly inside double quotes in Bash
$ResolvedRuntimeRoot = $RuntimeRoot
if ($ResolvedRuntimeRoot.StartsWith("~/")) {
    $ResolvedRuntimeRoot = "`$HOME/" + $ResolvedRuntimeRoot.Substring(2)
}

# Generate bash scripts to run over stdin.
# Keep them as literal templates so Bash syntax like $(...) and ${...}
# is not pre-evaluated by PowerShell before entering WSL.
$EnsureDependenciesBashCommand = @'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

python_runtime_ready() {
  command -v python3 >/dev/null 2>&1 || return 1

  local probe_root=""
  probe_root="$(mktemp -d)"
  if python3 -m venv "$probe_root/probe" >/dev/null 2>&1; then
    rm -rf "$probe_root"
    return 0
  fi

  rm -rf "$probe_root"
  return 1
}

apt_get_with_retry() {
  local attempt=1
  local max_attempts=5
  local exit_code=0

  while (( attempt <= max_attempts )); do
    if apt-get -o DPkg::Lock::Timeout=60 "$@"; then
      return 0
    fi

    exit_code=$?
    echo "[step] apt-get $* failed on attempt ${attempt}/${max_attempts}"
    dpkg --configure -a >/dev/null 2>&1 || true
    if (( attempt == max_attempts )); then
      return $exit_code
    fi

    sleep 5
    attempt=$((attempt + 1))
  done

  return $exit_code
}

if python_runtime_ready; then
  echo "[step] Ubuntu Python runtime dependencies already available"
  exit 0
fi

echo "[step] Installing Ubuntu Python runtime dependencies"
apt_get_with_retry update || {
  echo "Failed to install required Ubuntu packages: apt-get update did not succeed"
  exit 1
}
apt_get_with_retry install -y python3 python3-venv python3-full ca-certificates || {
  echo "Failed to install required Ubuntu packages: python3 python3-venv python3-full ca-certificates"
  exit 1
}

if ! python_runtime_ready; then
  echo "Automatic dependency installation completed, but python3 -m venv is still unavailable"
  exit 1
fi

echo "[step] Ubuntu Python runtime dependencies ready"
'@
$EnsureDependenciesBashCommand = $EnsureDependenciesBashCommand -replace "`r`n", "`n"

$BashCommand = @'
set -euo pipefail

python_runtime_ready() {
  command -v python3 >/dev/null 2>&1 || return 1

  local probe_root=""
  probe_root="$(mktemp -d)"
  if python3 -m venv "$probe_root/probe" >/dev/null 2>&1; then
    rm -rf "$probe_root"
    return 0
  fi

  rm -rf "$probe_root"
  return 1
}

echo "[step] Preparing runtime directories"
mkdir -p "__UFREN_RUNTIME_ROOT__/scripts" "__UFREN_RUNTIME_ROOT__/logs" "__UFREN_RUNTIME_ROOT__/state"

echo "[step] Syncing runtime shell scripts"
cp -f "$UFREN_SOURCE_WIN"/*.sh "__UFREN_RUNTIME_ROOT__/scripts/"
chmod +x "__UFREN_RUNTIME_ROOT__/scripts/"*.sh

echo "[step] Syncing hermes-agent sources"
rm -rf "__UFREN_RUNTIME_ROOT__/hermes-agent"
mkdir -p "__UFREN_RUNTIME_ROOT__/hermes-agent"
cp -a "$UFREN_AGENT_WIN"/. "__UFREN_RUNTIME_ROOT__/hermes-agent/"

if ! python_runtime_ready; then
  echo 'python3 and python3-venv could not be provisioned automatically in target distro'
  exit 1
fi
echo "[step] Creating Python virtual environment"
rm -rf "__UFREN_RUNTIME_ROOT__/.venv"
python3 -m venv "__UFREN_RUNTIME_ROOT__/.venv"
echo "[step] Upgrading Python packaging tools"
"__UFREN_RUNTIME_ROOT__/.venv/bin/python" -m pip install --disable-pip-version-check --no-input --upgrade pip setuptools wheel
echo "[step] Installing hermes-agent with dashboard dependencies into the virtual environment"
"__UFREN_RUNTIME_ROOT__/.venv/bin/python" -m pip install --disable-pip-version-check --no-input --upgrade "__UFREN_RUNTIME_ROOT__/hermes-agent[web]"

echo "[step] Verifying hermes CLI"
"__UFREN_RUNTIME_ROOT__/.venv/bin/hermes" --help >/dev/null
'@
$BashCommand = $BashCommand.Replace("__UFREN_RUNTIME_ROOT__", $ResolvedRuntimeRoot)
$BashCommand = $BashCommand -replace "`r`n", "`n"

# Pipe the script directly to bash inside WSL. This avoids Windows command line
# quoting issues while keeping the implementation simple and compatible.
Write-BootstrapLog "Starting runtime bootstrap"
Write-BootstrapLog "Distribution: $Distribution"
Write-BootstrapLog "Runtime root: $RuntimeRoot"
Write-BootstrapLog "WSL source path: $SourceWindowsPath"
Write-BootstrapLog "Hermes agent path: $AgentSourceWindowsPath"
$DependencyExitCode = Invoke-WslBashScript -BashCommand $EnsureDependenciesBashCommand -User "root"
if ($DependencyExitCode -ne 0) {
    [Console]::Error.WriteLine(("{0} WSL dependency bootstrap failed with exit code {1}" -f $BrandPrefix, $DependencyExitCode))
    exit $DependencyExitCode
}

$BootstrapExitCode = Invoke-WslBashScript -BashCommand $BashCommand
if ($BootstrapExitCode -ne 0) {
    [Console]::Error.WriteLine(("{0} WSL bootstrap script failed with exit code {1}" -f $BrandPrefix, $BootstrapExitCode))
    exit $BootstrapExitCode
}

Write-BootstrapLog "Runtime bootstrap completed for $Distribution with hermes-agent synchronized"
