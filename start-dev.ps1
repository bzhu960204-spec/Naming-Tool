param(
  [int]$ApiPort = 8787,
  [int]$WebPort = 5173,
  [switch]$StopExisting = $false
)

$ErrorActionPreference = 'Stop'

function Stop-ListeningProcessByPort {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    Write-Host "No listening process on port $Port"
    return
  }
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped process $processId on port $Port"
    } catch {
      Write-Host "Failed to stop process $processId on port ${Port}: $($_.Exception.Message)"
    }
  }
}

function Test-PortListening {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $null -ne $connections
}

function Get-NextAvailablePort {
  param(
    [int]$StartPort,
    [int[]]$ReservedPorts = @(),
    [int]$MaxSteps = 100
  )
  $candidate = $StartPort
  for ($i = 0; $i -le $MaxSteps; $i++) {
    if (($ReservedPorts -contains $candidate) -or (Test-PortListening -Port $candidate)) {
      $candidate++
      continue
    }
    return $candidate
  }
  throw "Could not find an available port after checking $MaxSteps ports from $StartPort"
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Join-Path $scriptRoot 'apps\api'
$webDir = Join-Path $scriptRoot 'apps\web'

if (-not (Test-Path $apiDir)) { throw "API directory not found: $apiDir" }
if (-not (Test-Path $webDir)) { throw "Web directory not found: $webDir" }

# --- Ensure dependencies are installed (first run) ---
# The workspace root holds the hoisted node_modules. On a fresh clone it does
# not exist, so install once from the repo root.
$rootNodeModules = Join-Path $scriptRoot 'node_modules'
if (-not (Test-Path $rootNodeModules)) {
  Write-Host "Dependencies missing. Running 'npm install' at repo root..." -ForegroundColor Yellow
  Push-Location $scriptRoot
  try {
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
    Write-Host "npm install completed." -ForegroundColor Green
  }
  finally {
    Pop-Location
  }
} else {
  Write-Host "Dependencies already installed. Skipping npm install." -ForegroundColor DarkGray
}

if ($StopExisting) {
  Stop-ListeningProcessByPort -Port $ApiPort
  Stop-ListeningProcessByPort -Port $WebPort
}

# --- Pick free ports, skipping any that are occupied ---
$requestedApiPort = $ApiPort
$requestedWebPort = $WebPort

$ApiPort = Get-NextAvailablePort -StartPort $ApiPort
$WebPort = Get-NextAvailablePort -StartPort $WebPort -ReservedPorts @($ApiPort)

if ($ApiPort -ne $requestedApiPort) { Write-Host "API port $requestedApiPort is occupied. Switched to $ApiPort" -ForegroundColor Yellow }
if ($WebPort -ne $requestedWebPort) { Write-Host "Web port $requestedWebPort is occupied. Switched to $WebPort" -ForegroundColor Yellow }

# --- Publish the chosen ports so the whole project agrees on them ---
# .dev-ports.json is a single source of truth other tooling can read; the env
# vars below feed the API (PORT) and the Vite proxy (BACKEND_PORT/FRONTEND_PORT)
# so the frontend proxy always points at the backend that is actually running.
$portsFile = Join-Path $scriptRoot '.dev-ports.json'
[pscustomobject]@{
  apiPort   = $ApiPort
  webPort   = $WebPort
  apiUrl    = "http://localhost:$ApiPort"
  webUrl    = "http://localhost:$WebPort"
  updatedAt = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -Path $portsFile -Encoding UTF8

Write-Host ""
Write-Host "=== DSV EDI Naming Tool - Dev Start ===" -ForegroundColor Cyan
Write-Host "  API  : http://localhost:$ApiPort" -ForegroundColor Green
Write-Host "  Web  : http://localhost:$WebPort" -ForegroundColor Green
Write-Host "  Ports written to: $portsFile" -ForegroundColor DarkGray
Write-Host ""

# --- Start API (Hono + tsx) ---
# PORT is read by apps/api/src/index.ts (Number(process.env.PORT ?? 8787)).
$apiJob = Start-Job -Name 'naming-api' -ScriptBlock {
  param([string]$Dir, [int]$Port)
  Set-Location $Dir
  $env:PORT = $Port.ToString()
  & node --import tsx src/index.ts 2>&1 | ForEach-Object { $_.ToString() }
} -ArgumentList $apiDir, $ApiPort

# --- Wait for API to come up ---
Write-Host "Waiting for API on port $ApiPort..." -ForegroundColor Yellow
$maxWait = 60
$waited = 0
$ready = $false

while ($waited -lt $maxWait) {
  Receive-Job -Job $apiJob -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "[api] $_"
  }
  if (Test-PortListening -Port $ApiPort) { $ready = $true; break }
  Start-Sleep -Seconds 1
  $waited++
  if ($waited % 10 -eq 0) {
    Write-Host "  still waiting... ($waited s)" -ForegroundColor DarkGray
  }
}

if (-not $ready) {
  Write-Host "API did not start within $maxWait seconds. Starting web anyway." -ForegroundColor Yellow
} else {
  Write-Host "API ready after $waited s." -ForegroundColor Green
}

# --- Start Web (Vite) ---
# BACKEND_PORT / FRONTEND_PORT are read by apps/web/vite.config.ts so the /api
# proxy targets the live API port and Vite serves on the chosen web port.
$webJob = Start-Job -Name 'naming-web' -ScriptBlock {
  param([string]$Dir, [int]$ApiPort, [int]$Port)
  Set-Location $Dir
  $env:BACKEND_PORT = $ApiPort.ToString()
  $env:FRONTEND_PORT = $Port.ToString()
  & npx vite --host 0.0.0.0 --port $Port 2>&1 | ForEach-Object { $_.ToString() }
} -ArgumentList $webDir, $ApiPort, $WebPort

Write-Host ""
Write-Host "Both services started. Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host "  To stop without Ctrl+C: .\stop-dev.ps1" -ForegroundColor DarkGray
Write-Host ""

try {
  while ($true) {
    $hadOutput = $false

    Receive-Job -Job $apiJob -ErrorAction SilentlyContinue | ForEach-Object {
      $hadOutput = $true
      Write-Host "[api] $_"
    }

    Receive-Job -Job $webJob -ErrorAction SilentlyContinue | ForEach-Object {
      $hadOutput = $true
      Write-Host "[web] $_"
    }

    $apiDone = $apiJob.State -in @('Completed', 'Failed', 'Stopped')
    $webDone = $webJob.State -in @('Completed', 'Failed', 'Stopped')

    if ($apiDone -and -not $webDone) {
      Write-Host ""
      Write-Host "[!] API process stopped unexpectedly. Check output above." -ForegroundColor Red
    }
    if ($webDone -and -not $apiDone) {
      Write-Host ""
      Write-Host "[!] Web process stopped unexpectedly." -ForegroundColor Red
    }

    if ($apiDone -and $webDone) { break }

    if (-not $hadOutput) { Start-Sleep -Milliseconds 250 }
  }
}
finally {
  Write-Host ""
  Write-Host "Process states: api=$($apiJob.State), web=$($webJob.State)" -ForegroundColor DarkGray

  if ($apiJob.State -notin @('Completed', 'Failed', 'Stopped')) {
    Stop-Job -Job $apiJob -Force -ErrorAction SilentlyContinue
  }
  if ($webJob.State -notin @('Completed', 'Failed', 'Stopped')) {
    Stop-Job -Job $webJob -Force -ErrorAction SilentlyContinue
  }

  Remove-Job -Job $apiJob, $webJob -Force -ErrorAction SilentlyContinue
  Write-Host "Services stopped." -ForegroundColor Yellow
}
