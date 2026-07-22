<#
.SYNOPSIS
  Sets up EastEnd TV Signage on this Windows PC: installs dependencies,
  builds for production, registers it as an auto-starting/auto-restarting
  Windows Service, and opens the firewall for TVs on the network.

.NOTES
  Run this from an Administrator PowerShell window (right-click PowerShell,
  "Run as Administrator"), or just double-click deploy/setup.bat, which
  launches this elevated automatically. Safe to re-run any time you update
  the app's code — it rebuilds and restarts the service instead of
  reinstalling it.
#>

$ErrorActionPreference = "Stop"
$Port = 3000

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-LastExitCode($description) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$description failed (exit code $LASTEXITCODE)." -ForegroundColor Red
        exit 1
    }
}

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host "This script must run as Administrator (it installs a Windows Service and a firewall rule)." -ForegroundColor Red
    Write-Host "Right-click PowerShell and choose 'Run as Administrator', then run this script again -- or just double-click deploy\setup.bat instead." -ForegroundColor Red
    exit 1
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "Could not find package.json in $ProjectRoot -- run this script from inside the EastEnd project's deploy\ folder." -ForegroundColor Red
    exit 1
}

# 1. Node.js
Write-Step "Checking for Node.js"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js was not found." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Installing Node.js LTS via winget..."
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        # Refresh PATH in this session so node/npm are usable without reopening the terminal.
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
        Write-Host "winget isn't available. Install Node.js LTS manually from https://nodejs.org, then re-run this script." -ForegroundColor Red
        exit 1
    }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js still isn't on PATH. Close this window, reopen an Administrator PowerShell, and re-run this script." -ForegroundColor Red
    exit 1
}
node -v
npm -v

# 2. Dependencies
Write-Step "Installing dependencies (npm install)"
npm install
Assert-LastExitCode "npm install"

# No admin password prompt here -- the first visit to /admin walks through
# creating the account right in the browser (see app/admin/setup). This
# script only needs to get the server running.

# 3. Production build
Write-Step "Building for production (npm run build)"
npm run build
Assert-LastExitCode "npm run build"

# 4. Windows Service (install, or restart if already installed)
Write-Step "Setting up the Windows Service"
$existingService = Get-Service -Name "EastEndTVSignage" -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Service already installed -- restarting it to pick up this build..."
    Restart-Service -Name "EastEndTVSignage"
} else {
    npm run service:install
    Assert-LastExitCode "npm run service:install"
    Start-Sleep -Seconds 3
}

# 5. Firewall rule so TVs on the LAN can reach this PC
Write-Step "Opening the firewall for devices on the network"
$existingRule = Get-NetFirewallRule -DisplayName "EastEnd TV Signage" -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -DisplayName "EastEnd TV Signage" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow | Out-Null
    Write-Host "Firewall rule added for TCP port $Port."
} else {
    Write-Host "Firewall rule already exists."
}

# 6. Summary
Write-Step "Setup complete"
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Admin dashboard (from this PC):      http://localhost:$Port/admin"
if ($lanIp) {
    Write-Host "Admin dashboard (from the network):  http://${lanIp}:$Port/admin"
    Write-Host "Point each TV's browser at:          http://${lanIp}:${Port}/dis/<screenId>"
} else {
    Write-Host "Could not auto-detect a LAN IP -- run 'ipconfig' and look for the IPv4 Address." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "EastEndTVSignage will now auto-start on boot and restart itself if it ever crashes." -ForegroundColor Green
Write-Host "If this is the first time setting this up, visiting the admin dashboard above will ask you to create the admin account." -ForegroundColor Green
