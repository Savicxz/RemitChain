param(
  [string]$ImageName = "remitchain-node",
  [string]$ContainerName = "remitchain-node",
  [int]$RpcPort = 9933,
  [int]$WsPort = 9944,
  [int]$P2pPort = 30333,
  [int]$PromPort = 9615,
  [switch]$Rebuild,
  [switch]$NoBuild,
  [switch]$NoBuildKit
)

$ErrorActionPreference = "Stop"

function Has-Command([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Resolve-DockerComposeCommand() {
  if (Has-Command "docker") {
    try {
      docker compose version 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{
          Command = "docker"
          Args = @("compose")
          ProjectFlag = "--project-name"
        }
      }
    } catch {}
  }

  if (Has-Command "docker-compose") {
    try {
      docker-compose version 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{
          Command = "docker-compose"
          Args = @()
          ProjectFlag = "-p"
        }
      }
    } catch {}
  }

  return $null
}

function Has-DockerCompose() {
  return $null -ne (Resolve-DockerComposeCommand)
}

function Ensure-Docker {
  try {
    docker info | Out-Null
    return $true
  } catch {
    Write-Host "Docker engine not responding. Attempting to start Docker Desktop..."
  }

  $desktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $desktop) {
    Start-Process $desktop | Out-Null
  } else {
    Write-Host "Docker Desktop not found at $desktop"
    return $false
  }

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
      docker info | Out-Null
      return $true
    } catch {
      # keep waiting
    }
  }

  Write-Host "Docker engine still not responding."
  return $false
}

function Invoke-DockerCompose([string[]]$composeArgs, [bool]$useBuildKit) {
  $cmd = Resolve-DockerComposeCommand
  if (-not $cmd) { return 1 }
  $env:DOCKER_BUILDKIT = if ($useBuildKit) { "1" } else { "0" }
  $fullArgs = @()
  if ($cmd.Args) { $fullArgs += $cmd.Args }
  if ($composeArgs) { $fullArgs += $composeArgs }
  & $cmd.Command @fullArgs
  return $LASTEXITCODE
}

function Invoke-DockerBuild([bool]$useBuildKit) {
  $env:DOCKER_BUILDKIT = if ($useBuildKit) { "1" } else { "0" }
  $progress = if ($useBuildKit) { "--progress=auto" } else { "" }
  if ($progress -ne "") {
    & docker build $progress -t $ImageName ./chain
  } else {
    & docker build -t $ImageName ./chain
  }
  return $LASTEXITCODE
}

if (!(Has-Command "docker")) {
  Write-Host "Docker not found. Install Docker Desktop to run the chain container."
  exit 1
}

if (!(Ensure-Docker)) {
  exit 1
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$composeProject = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { "remitchain" }
$composeFile = Join-Path $root "docker-compose.yml"
$useCompose = (Test-Path $composeFile) -and (Has-DockerCompose)

if ($useCompose) {
  $envFile = Join-Path $root ".env.local"
  $composeCmd = Resolve-DockerComposeCommand
  if (-not $composeCmd) {
    Write-Host "Docker compose command not available."
    exit 1
  }
  $composeArgs = @()
  if ($composeProject) {
    $composeArgs += @($composeCmd.ProjectFlag, $composeProject)
  }
  if (Test-Path $envFile) {
    $composeArgs += @("--env-file", $envFile)
  }

  $useBuildKit = -not $NoBuildKit

  $upArgs = $composeArgs + @("up", "-d", "chain")
  if ($Rebuild) {
    $upArgs += "--build"
    $upArgs += "--progress=auto"
  } elseif ($NoBuild) {
    $upArgs += "--no-build"
  }
  Write-Host "Starting chain via docker compose..."
  $exitCode = Invoke-DockerCompose $upArgs $useBuildKit
  if ($exitCode -ne 0 -and $useBuildKit) {
    Write-Host "Compose up failed with BuildKit. Retrying with legacy builder..."
    $exitCode = Invoke-DockerCompose $upArgs $false
  }
  if ($exitCode -ne 0) {
    Write-Host "Chain container start failed."
    exit $exitCode
  }

  Write-Host "Chain container started. WS endpoint: ws://127.0.0.1:${WsPort}"
  exit 0
}

if (-not $NoBuild -and ($Rebuild -or -not (docker images --format "{{.Repository}}:{{.Tag}}" | Select-String -Pattern "^${ImageName}:"))) {
  Write-Host "Building chain image: $ImageName"
  $useBuildKit = -not $NoBuildKit
  $exitCode = Invoke-DockerBuild $useBuildKit
  if ($exitCode -ne 0 -and $useBuildKit) {
    Write-Host "Build failed with BuildKit. Retrying with legacy builder..."
    $exitCode = Invoke-DockerBuild $false
  }
  if ($exitCode -ne 0) {
    Write-Host "Chain image build failed."
    exit $exitCode
  }
}

$existing = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^${ContainerName}$"
if ($existing) {
  Write-Host "Removing existing container: $ContainerName"
  docker rm -f $ContainerName | Out-Null
}

Write-Host "Starting chain container: $ContainerName"

docker run -d --name $ContainerName `
  -p ${P2pPort}:30333 `
  -p ${RpcPort}:9933 `
  -p ${WsPort}:9944 `
  -p ${PromPort}:9615 `
  $ImageName `
  --dev --tmp --state-pruning archive --blocks-pruning archive --rpc-external --unsafe-rpc-external --rpc-cors all

Write-Host "Chain container started. WS endpoint: ws://127.0.0.1:${WsPort}"
