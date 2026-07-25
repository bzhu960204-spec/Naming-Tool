param(
  [int[]]$Ports
)

$ErrorActionPreference = 'Continue'

# If no ports were passed, read the dynamic ports the launcher last published so
# we stop whatever is actually running, then fall back to the defaults.
if (-not $Ports) {
  $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $portsFile = Join-Path $scriptRoot '.dev-ports.json'
  if (Test-Path $portsFile) {
    try {
      $saved = Get-Content $portsFile -Raw | ConvertFrom-Json
      $Ports = @($saved.apiPort, $saved.webPort)
      Write-Host "Using ports from .dev-ports.json: $($Ports -join ', ')"
    } catch {
      $Ports = @(8787, 5173)
    }
  } else {
    $Ports = @(8787, 5173)
  }
}

foreach ($port in $Ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    Write-Host "No listening process on port $port"
    continue
  }

  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped process $processId on port $port"
    } catch {
      Write-Host "Failed to stop process $processId on port ${port}: $($_.Exception.Message)"
    }
  }
}

# Also clean up any lingering background jobs from this session.
Get-Job -Name 'naming-api', 'naming-web' -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Job  $_ -Force -ErrorAction SilentlyContinue
  Remove-Job $_ -Force -ErrorAction SilentlyContinue
  Write-Host "Removed background job: $($_.Name)"
}
