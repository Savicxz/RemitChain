param(
  [string]$ChainCommand = "",
  [switch]$SkipRedis,
  [switch]$SkipSubquery,
  [switch]$SkipPostgres
)

$ErrorActionPreference = "Stop"

function Read-EnvFile([string]$path) {
  $map = @{}
  if (!(Test-Path $path)) {
    return $map
  }

  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) {
      return
    }
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
      $map[$parts[0]] = $parts[1]
    }
  }
  return $map
}

function Apply-Env($map) {
  foreach ($k in $map.Keys) {
    $v = $map[$k]
    if ($null -ne $v) {
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

function Ensure-EnvFile([string]$path, [string]$example) {
  if (!(Test-Path $path) -and (Test-Path $example)) {
    Copy-Item $example $path -Force
    Write-Host "Created $path"
  }
}

function Has-Command([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Test-PortInUse([int]$port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    return $null -ne $conn
  } catch {
    return $false
  }
}

function Has-DockerCompose() {
  if (!(Has-Command "docker")) {
    return $false
  }

  try {
    docker compose version | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Export-ChainMetadata([int]$retries = 15, [int]$delaySeconds = 2) {
  if (!(Has-Command "npm")) {
    Write-Host "npm not found. Skipping chain metadata export."
    return $false
  }

  for ($attempt = 1; $attempt -le $retries; $attempt++) {
    Write-Host "Exporting chain metadata (attempt $attempt/$retries)..."
    npm run chain:metadata:apply
    if ($LASTEXITCODE -eq 0) {
      return $true
    }
    Start-Sleep -Seconds $delaySeconds
  }

  Write-Host "Chain metadata export failed. You can retry with: npm run chain:metadata:apply"
  return $false
}

$composeProject = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { "remitchain" }

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Ensure-EnvFile ".env.local" ".env.example"
Ensure-EnvFile "services/relayer/.env" "services/relayer/.env.example"
Ensure-EnvFile "subquery/.env" "subquery/.env.example"

# If chain metadata hasn't been exported yet, remind the user.
$chainInfoPath = Join-Path $root "chain/chain-info.json"
if (!(Test-Path $chainInfoPath)) {
  Write-Host "Chain metadata not found. Will attempt to export it once the chain is reachable."
}

Apply-Env (Read-EnvFile ".env.local")
Apply-Env (Read-EnvFile "services/relayer/.env")
Apply-Env (Read-EnvFile "subquery/.env")

# Use cmd.exe for npm scripts to avoid PowerShell parsing issues with "||"
$env:npm_config_script_shell = $env:ComSpec

if ($ChainCommand -ne "") {
  $env:CHAIN_COMMAND = $ChainCommand
}

if (!$SkipRedis -and $env:REDIS_URL) {
  $rawRedis = $env:REDIS_URL
  $redisHost = 'localhost'
  $redisPort = 6379
  $shouldAttemptRedis = $false
  $redisUri = $null

  if ([System.Uri]::TryCreate($rawRedis, [System.UriKind]::Absolute, [ref]$redisUri)) {
    $redisHost = $redisUri.Host
    if ($redisUri.Port -gt 0) {
      $redisPort = $redisUri.Port
    }
  } elseif ($rawRedis -match 'localhost|127\.0\.0\.1') {
    $shouldAttemptRedis = $true
  }

  if ($env:REDIS_PORT) {
    $parsedRedisPort = 0
    if ([int]::TryParse($env:REDIS_PORT, [ref]$parsedRedisPort)) {
      if ($redisUri -eq $null -or $redisUri.Port -le 0) {
        $redisPort = $parsedRedisPort
      }
    }
  }

  if ($redisHost -in @('localhost', '127.0.0.1')) {
    $shouldAttemptRedis = $true
  }

  if ($shouldAttemptRedis) {
    if (Test-PortInUse $redisPort) {
      Write-Host "Redis port $redisPort already in use. Skipping Docker Redis."
    } elseif ((Test-Path (Join-Path $root 'docker-compose.yml')) -and (Has-DockerCompose)) {
      $envFile = Join-Path $root '.env.local'
      if (Test-Path $envFile) {
        docker compose --project-name $composeProject --env-file $envFile up -d redis
      } else {
        docker compose --project-name $composeProject up -d redis
      }
      Write-Host "Started Redis via docker compose."
    } else {
      Write-Host "Docker compose not available. Skipping Redis startup."
    }
  } else {
    Write-Host "REDIS_URL host not local. Skipping Docker Redis."
  }
}

if (!$SkipPostgres -and $env:DATABASE_URL) {
  $rawUrl = $env:DATABASE_URL
  $dbHost = 'localhost'
  $port = 5432
  $dbName = 'remitchain'
  $pgUser = 'postgres'
  $pgPassword = 'postgres'
  $shouldAttempt = $false

  $uri = $null
  if ([System.Uri]::TryCreate($rawUrl, [System.UriKind]::Absolute, [ref]$uri)) {
    $dbHost = $uri.Host
    $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    $dbName = $uri.AbsolutePath.TrimStart('/')

    if ($uri.UserInfo) {
      $parts = $uri.UserInfo.Split(':', 2)
      if ($parts.Length -gt 0 -and $parts[0]) { $pgUser = $parts[0] }
      if ($parts.Length -gt 1 -and $parts[1]) { $pgPassword = $parts[1] }
    }

    if ($dbHost -in @('localhost', '127.0.0.1')) {
      $shouldAttempt = $true
    }
  } else {
    if ($rawUrl -match 'localhost|127\.0\.0\.1') {
      $shouldAttempt = $true
    }
  }

  if ($shouldAttempt) {
    if (Test-PortInUse $port) {
      Write-Host "Postgres port $port already in use. Skipping Docker Postgres."
    } else {
      if ((Test-Path (Join-Path $root 'docker-compose.yml')) -and (Has-DockerCompose)) {
        $env:POSTGRES_USER = $pgUser
        $env:POSTGRES_PASSWORD = $pgPassword
        $env:POSTGRES_DB = $dbName
        $env:POSTGRES_PORT = $port
        $envFile = Join-Path $root '.env.local'
        if (Test-Path $envFile) {
          docker compose --project-name $composeProject --env-file $envFile up -d postgres
        } else {
          docker compose --project-name $composeProject up -d postgres
        }
        Write-Host "Started Postgres via docker compose."
      } else {
        Write-Host "Docker compose not available. Skipping Postgres startup."
      }
    }
  } else {
    Write-Host "DATABASE_URL host not local. Skipping Docker Postgres."
  }
}

if ($env:CHAIN_COMMAND) {
  Write-Host "Starting chain: $($env:CHAIN_COMMAND)"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $env:CHAIN_COMMAND -WorkingDirectory $root
} else {
  Write-Host "CHAIN_COMMAND not set. Start your chain manually."
}

if ($env:CHAIN_WS_URL) {
  Export-ChainMetadata | Out-Null
}

$relayerDir = Join-Path $root "services/relayer"
$relayerBin = Join-Path $relayerDir "node_modules/.bin/tsx"
if (!(Test-Path $relayerBin)) {
  Write-Host "Installing relayer dependencies..."
  Push-Location $relayerDir
  npm install
  Pop-Location
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory $relayerDir

$webBin = Join-Path $root "node_modules/.bin/next"
if (!(Test-Path $webBin)) {
  Write-Host "Installing web dependencies..."
  npm install
}

if ($env:DATABASE_URL) {
  Write-Host "Preparing Prisma client..."
  npm run prisma:generate

  $migrationsDir = Join-Path $root "prisma/migrations"
  if (Test-Path $migrationsDir) {
    Write-Host "Applying Prisma migrations..."
    npm run prisma:deploy
  } else {
    Write-Host "Initializing Prisma migrations..."
    npm run prisma:migrate -- --name init
  }
} else {
  Write-Host "DATABASE_URL not set. Skipping Prisma."
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory $root

if (-not $SkipSubquery) {
  if (Has-Command "subql") {
    $subqueryDir = Join-Path $root "subquery"
    if (!(Test-Path (Join-Path $subqueryDir "node_modules"))) {
      Write-Host "Installing SubQuery dependencies..."
      Push-Location $subqueryDir
      npm install
      Pop-Location
    }

    Push-Location $subqueryDir
    subql codegen -f project.ts
    subql build -f project.ts
    Pop-Location

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "subql-node -f project.ts" -WorkingDirectory $subqueryDir
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "subql-query -f project.ts" -WorkingDirectory $subqueryDir
  } else {
    Write-Host "SubQuery CLI not found. Skipping SubQuery."
  }
}

Write-Host "All services started."
