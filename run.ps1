<#
.SYNOPSIS
Runs and maintains the SP Workstation on Ubuntu with PowerShell 7.

.DESCRIPTION
This cross-platform PowerShell script wraps the npm commands used by the
project. Run it from any directory; it always switches to the repository root.

.EXAMPLE
pwsh ./run.ps1 install

.EXAMPLE
pwsh ./run.ps1 dev

.EXAMPLE
pwsh ./run.ps1 build

.EXAMPLE
pwsh ./run.ps1 start -Port 3000
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("help", "install", "dev", "build", "start", "lint", "seed")]
    [string]$Action = "dev",

    [ValidateRange(1, 65535)]
    [int]$Port = 3000,

    [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

function Write-Step {
    param([string]$Message)
    Write-Host "[SP Workstation] $Message" -ForegroundColor Yellow
}

function Assert-Command {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "'$Name' was not found. $InstallHint"
    }
}

function Initialize-LocalEnvironment {
    $environmentFile = Join-Path $ProjectRoot ".env.local"

    if (Test-Path $environmentFile) {
        return
    }

    $secretBytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    $jwtSecret = [Convert]::ToHexString($secretBytes).ToLowerInvariant()

    @"
MONGODB_URI=memory
JWT_SECRET=$jwtSecret
NEXT_PUBLIC_APP_URL=http://${HostAddress}:${Port}
NEXT_PUBLIC_SP_DASHBOARD_URL=https://sp-dashboard-eta.vercel.app
EMAIL_DEV_MODE=true
"@ | Set-Content -Path $environmentFile -Encoding utf8

    Write-Step "Created .env.local with an ephemeral MongoDB and development OTP previews."
}

function Install-DependenciesIfMissing {
    if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
        Write-Step "node_modules is missing; installing dependencies."
        & npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE."
        }
    }
}

function Invoke-Npm {
    param([string[]]$Arguments)

    & npm @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

Assert-Command -Name "node" -InstallHint "Install Node.js 20.9 or newer."
Assert-Command -Name "npm" -InstallHint "Install npm with Node.js."

Push-Location $ProjectRoot
try {
    switch ($Action) {
        "help" {
            Get-Help $PSCommandPath -Detailed
        }
        "install" {
            Write-Step "Installing exact dependencies from package-lock.json."
            Invoke-Npm -Arguments @("ci")
        }
        "dev" {
            Install-DependenciesIfMissing
            Initialize-LocalEnvironment
            Write-Step "Starting development server at http://${HostAddress}:${Port}"
            Write-Step "Press Ctrl+C to stop."
            Invoke-Npm -Arguments @(
                "run", "dev", "--", "-H", $HostAddress, "-p", "$Port"
            )
        }
        "build" {
            Install-DependenciesIfMissing
            Initialize-LocalEnvironment
            Write-Step "Creating an optimized production build."
            Invoke-Npm -Arguments @("run", "build")
        }
        "start" {
            Install-DependenciesIfMissing
            Initialize-LocalEnvironment
            if (-not (Test-Path (Join-Path $ProjectRoot ".next"))) {
                throw "No .next build found. Run 'pwsh ./run.ps1 build' first."
            }
            Write-Step "Starting production server at http://${HostAddress}:${Port}"
            Write-Step "Press Ctrl+C to stop."
            Invoke-Npm -Arguments @(
                "run", "start", "--", "-H", $HostAddress, "-p", "$Port"
            )
        }
        "lint" {
            Install-DependenciesIfMissing
            Write-Step "Running ESLint."
            Invoke-Npm -Arguments @("run", "lint")
        }
        "seed" {
            Install-DependenciesIfMissing
            Initialize-LocalEnvironment
            Write-Step "Seeding the configured MongoDB database."
            Invoke-Npm -Arguments @("run", "seed")
        }
        default {
            throw "Unsupported action: $Action"
        }
    }
}
finally {
    Pop-Location
}
