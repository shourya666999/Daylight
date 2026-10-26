$ErrorActionPreference = 'Stop'
Write-Host 'Daylight launcher is running. Checking the saved local server address...'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $root 'server.mjs'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Host 'Node.js was not found. Install a current Node.js release, then run Start Daylight.bat again.' -ForegroundColor Red
  exit 1
}

if ($env:LOCALAPPDATA) {
  $dataFolder = Join-Path $env:LOCALAPPDATA 'DaylightTracker'
} else {
  $dataFolder = Join-Path (Join-Path $HOME '.daylight-tracker') 'DaylightTracker'
}
$urlFile = Join-Path $dataFolder 'server-url.txt'

function Test-DaylightUrl([string] $url) {
  if ($url -notmatch '^http://127\.0\.0\.1:\d+$') { return $false }
  try {
    $health = Invoke-RestMethod -Uri "$url/api/health" -Method Get -TimeoutSec 1 -ErrorAction Stop
    return ($health.ok -eq $true -and $health.version -eq '0.1.0' -and -not [string]::IsNullOrWhiteSpace([string]$health.storage))
  } catch {
    return $false
  }
}

function Find-DaylightUrl {
  if (-not (Test-Path -LiteralPath $urlFile)) { return $null }
  $recorded = (Get-Content -LiteralPath $urlFile -Raw -ErrorAction SilentlyContinue).Trim()
  if ($recorded -and (Test-DaylightUrl $recorded)) { return $recorded }
  return $null
}

function Add-ExistingBrowserCandidate($list, [string] $candidate) {
  if ([string]::IsNullOrWhiteSpace($candidate)) { return }
  try {
    if ((Test-Path -LiteralPath $candidate -PathType Leaf) -and -not $list.Contains($candidate)) {
      $null = $list.Add($candidate)
    }
  } catch { }
}

function Open-DaylightWindow([string] $url) {
  $processes = @()
  try { $processes = Get-CimInstance Win32_Process -ErrorAction Stop } catch { }
  foreach ($process in $processes) {
    if ($process.Name -match '^(msedge|chrome)\.exe$' -and $process.CommandLine -and $process.CommandLine.Contains($url)) {
      Write-Host "A Daylight app window is already open at $url"
      return
    }
  }

  $edgeCandidates = [System.Collections.ArrayList]::new()
  $chromeCandidates = [System.Collections.ArrayList]::new()
  $edgeCommand = Get-Command msedge.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  $chromeCommand = Get-Command chrome.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($edgeCommand) { Add-ExistingBrowserCandidate $edgeCandidates $edgeCommand.Source }
  if ($chromeCommand) { Add-ExistingBrowserCandidate $chromeCandidates $chromeCommand.Source }
  if (${env:ProgramFiles(x86)}) {
    Add-ExistingBrowserCandidate $edgeCandidates (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
    Add-ExistingBrowserCandidate $chromeCandidates (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe')
  }
  if ($env:ProgramFiles) {
    Add-ExistingBrowserCandidate $edgeCandidates (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
    Add-ExistingBrowserCandidate $chromeCandidates (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe')
  }
  if ($env:LOCALAPPDATA) {
    Add-ExistingBrowserCandidate $edgeCandidates (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
    Add-ExistingBrowserCandidate $chromeCandidates (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  }

  foreach ($candidate in $edgeCandidates) {
    try {
      Write-Host "Opening Daylight in Edge app mode..."
      Start-Process -FilePath $candidate -ArgumentList @("--app=$url") -ErrorAction Stop | Out-Null
      return
    } catch {
      Write-Host "Edge launch failed at '$candidate'; trying the next option. $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
  foreach ($candidate in $chromeCandidates) {
    try {
      Write-Host "Opening Daylight in Chrome app mode..."
      Start-Process -FilePath $candidate -ArgumentList @("--app=$url") -ErrorAction Stop | Out-Null
      return
    } catch {
      Write-Host "Chrome launch failed at '$candidate'; trying the default browser. $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
  try {
    Write-Host 'Opening Daylight in the default browser...'
    Start-Process -FilePath $url -ErrorAction Stop | Out-Null
  } catch {
    Write-Host "Could not open the browser automatically. Open this address manually: $url" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
  }
}

$url = Find-DaylightUrl
if ($url) {
  Write-Host "A responding Daylight server was found. Opening $url"
  Open-DaylightWindow $url
  exit 0
}

Write-Host 'No responding saved server address was found. Starting the local server now...'
New-Item -ItemType Directory -Path $dataFolder -Force | Out-Null
Remove-Item -LiteralPath $urlFile -Force -ErrorAction SilentlyContinue
$outputLog = Join-Path $dataFolder 'server-output.log'
$errorLog = Join-Path $dataFolder 'server-error.log'
Set-Content -LiteralPath $outputLog -Value '' -Encoding UTF8
Set-Content -LiteralPath $errorLog -Value '' -Encoding UTF8
Write-Host 'The server console is minimized. Restore it and press Ctrl+C to stop Daylight.'
$serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @('--experimental-sqlite', "`"$serverPath`"") -WorkingDirectory $root -WindowStyle Minimized -PassThru -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog
Write-Host "Waiting for the server to publish its local address (up to 30 seconds)..."
$deadline = (Get-Date).AddSeconds(30)
$url = $null
while ((Get-Date) -lt $deadline) {
  if (Test-Path -LiteralPath $urlFile) {
    $candidate = (Get-Content -LiteralPath $urlFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($candidate -and (Test-DaylightUrl $candidate)) { $url = $candidate; break }
  }
  if ($serverProcess.HasExited) { break }
  Start-Sleep -Milliseconds 350
}
if (-not $url) {
  Write-Host 'Daylight did not become ready.' -ForegroundColor Red
  Write-Host "Server output log: $outputLog" -ForegroundColor Yellow
  Write-Host "Server error log:  $errorLog" -ForegroundColor Yellow
  $details = @(Get-Content -LiteralPath $errorLog -Tail 20 -ErrorAction SilentlyContinue) + @(Get-Content -LiteralPath $outputLog -Tail 20 -ErrorAction SilentlyContinue)
  if ($details.Count -gt 0) { $details | ForEach-Object { Write-Host $_ } }
  exit 1
}
Write-Host "Daylight is ready at $url"
Open-DaylightWindow $url