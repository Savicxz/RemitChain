param(
  [string]$ChainCommand = "",
  [switch]$ChainDocker,
  [switch]$ChainDockerRebuild,
  [switch]$ChainDockerNoBuild,
  [switch]$ChainDockerNoBuildKit,
  [switch]$Clean,
  [switch]$SkipRedis,
  [switch]$SkipSubquery,
  [switch]$SkipPostgres
)

$ErrorActionPreference = "Stop"
# In PowerShell 7+, native stderr can become terminating when this preference is true.
# That breaks startup flows where tools emit benign stderr warnings.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Write-Info([string]$message) { Write-Information -MessageData $message -InformationAction Continue }
function Write-Warn([string]$message) { Write-Warning $message }
function Write-Err([string]$message) { Write-Error -Message $message -ErrorAction Continue }

function Read-EnvFile([string]$path) {
  $map = @{}
  if (!(Test-Path $path)) { return $map }

  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
      $map[$parts[0]] = $parts[1]
    }
  }
  return $map
}

function Use-EnvMap($map) {
  foreach ($k in $map.Keys) {
    $v = $map[$k]
    if ($null -ne $v) {
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

function Initialize-EnvFile([string]$path, [string]$example) {
  if (!(Test-Path $path) -and (Test-Path $example)) {
    Copy-Item $example $path -Force
    Write-Info "Created $path"
  }
}

function Use-EnvIfMissing([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return }
  $existing = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  if (-not $existing) {
    Set-Item -Path "Env:$name" -Value $value
  }
}

function ConvertFrom-DatabaseUrl([string]$url) {
  if ([string]::IsNullOrWhiteSpace($url)) { return $null }
  $uri = $null
  if (-not [System.Uri]::TryCreate($url, [System.UriKind]::Absolute, [ref]$uri)) { return $null }

  $dbName = $uri.AbsolutePath.TrimStart('/')
  $dbUser = ""
  $dbPass = ""
  if ($uri.UserInfo) {
    $parts = $uri.UserInfo.Split(':', 2)
    if ($parts.Length -gt 0) { $dbUser = [System.Uri]::UnescapeDataString($parts[0]) }
    if ($parts.Length -gt 1) { $dbPass = [System.Uri]::UnescapeDataString($parts[1]) }
  }

  return [pscustomobject]@{
    Host = $uri.Host
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    User = $dbUser
    Pass = $dbPass
    Database = $dbName
  }
}

function Test-CommandAvailability([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Test-DockerComposeAvailability() {
  if (!(Test-CommandAvailability "docker")) { return $false }
  try {
    docker compose version | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Test-PortInUse([int]$port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    return $null -ne $conn
  } catch {
    return $false
  }
}

function Wait-For-PortFree([int]$port, [int]$timeoutSeconds = 20) {
  for ($i = 0; $i -lt $timeoutSeconds; $i++) {
    if (-not (Test-PortInUse $port)) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Wait-For-PortOpen([int]$port, [int]$timeoutSeconds = 30) {
  for ($i = 0; $i -lt $timeoutSeconds; $i++) {
    if (Test-PortInUse $port) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Get-UriHost([string]$url) {
  if ([string]::IsNullOrWhiteSpace($url)) { return "" }
  try { return ([System.Uri]$url).Host } catch { return "" }
}

function Get-UriPort([string]$url, [int]$fallback) {
  if ([string]::IsNullOrWhiteSpace($url)) { return $fallback }
  try {
    $uri = [System.Uri]$url
    if ($uri.Port -gt 0) { return $uri.Port }
  } catch {
    return $fallback
  }
  return $fallback
}

function Resolve-EnvPort([string]$value, [int]$fallback) {
  $port = $fallback
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    [int]::TryParse($value, [ref]$port) | Out-Null
  }
  return $port
}

function Test-LocalHost([string]$inputHost) {
  if ([string]::IsNullOrWhiteSpace($inputHost)) { return $false }
  return $inputHost -in @("localhost", "127.0.0.1", "::1")
}

function Get-ProcessCommandLine([int]$procId) {
  try {
    return (Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $procId)).CommandLine
  } catch {
    return $null
  }
}

function Resolve-ProcessByPortIfOwned([int]$port, [string]$label, [string]$projectRoot) {
  $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $conn) { return $true }

  $procId = $conn.OwningProcess
  if (-not $procId) { return $false }

  $cmd = Get-ProcessCommandLine $procId
  if ($cmd -and $projectRoot -and ($cmd -like "*$projectRoot*")) {
    Write-Info "$label port $port is in use by project process. Stopping PID $procId..."
    Stop-Process -Id $procId -Force
    Start-Sleep -Seconds 1
    return -not (Test-PortInUse $port)
  }

  Write-Warn "$label port $port is in use by another process (PID $procId)."
  return $false
}

function Resolve-ProcessByPortIfPatternMatch([int]$port, [string[]]$patterns, [string]$label) {
  $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $conn) { return $true }

  $procId = $conn.OwningProcess
  if (-not $procId) { return $false }

  $cmd = Get-ProcessCommandLine $procId
  if ($cmd) {
    foreach ($pattern in $patterns) {
      if ($cmd -like "*$pattern*") {
        Write-Info "$label port $port is in use by matching process. Stopping PID $procId..."
        Stop-Process -Id $procId -Force
        Start-Sleep -Seconds 1
        return -not (Test-PortInUse $port)
      }
    }
  }

  Write-Warn "$label port $port is in use by another process (PID $procId)."
  return $false
}

function Test-CommandLineRunning([string]$token, [string]$pathToken) {
  try {
    $match = Get-CimInstance Win32_Process | Where-Object {
      $_.CommandLine -and $_.CommandLine -like "*$token*" -and $_.CommandLine -like "*$pathToken*"
    } | Select-Object -First 1
    return $null -ne $match
  } catch {
    return $false
  }
}

function Resolve-ProcessByCommandTokenMatch([string]$token, [string]$pathToken, [string]$label) {
  $stoppedAny = $false
  try {
    $matchedProcesses = Get-CimInstance Win32_Process | Where-Object {
      $_.CommandLine -and $_.CommandLine -like "*$token*" -and ($pathToken -eq "" -or $_.CommandLine -like "*$pathToken*")
    }
    foreach ($match in $matchedProcesses) {
      if ($match.ProcessId) {
        Write-Info "Stopping $label process PID $($match.ProcessId)..."
        Stop-Process -Id $match.ProcessId -Force -ErrorAction SilentlyContinue
        $stoppedAny = $true
      }
    }
  } catch {
    return $false
  }

  if ($stoppedAny) {
    Start-Sleep -Seconds 1
  }

  return $stoppedAny
}

function Wait-ForProcess([string]$token, [string]$pathToken, [int]$timeoutSeconds = 30) {
  for ($i = 0; $i -lt $timeoutSeconds; $i++) {
    if (Test-CommandLineRunning $token $pathToken) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Get-ComposeEnvArg([string]$projectName, [string]$envFile) {
  $composeArgs = @("compose", "--project-name", $projectName)
  if ($envFile -and (Test-Path $envFile)) {
    $composeArgs += @("--env-file", $envFile)
  }
  return $composeArgs
}

function Test-ComposeServiceRunning([string]$projectName, [string]$service) {
  if (-not (Test-DockerComposeAvailability)) { return $false }
  try {
    $id = docker compose --project-name $projectName ps --status running -q $service
    if (-not [string]::IsNullOrWhiteSpace($id)) {
      return $true
    }

    # Fallback for older compose versions that may not support --status.
    $id = docker compose --project-name $projectName ps -q $service
    if ([string]::IsNullOrWhiteSpace($id)) {
      return $false
    }

    $isRunning = docker inspect -f "{{.State.Running}}" $id 2>$null
    return ($isRunning -eq "true")
  } catch {
    return $false
  }
}

function Invoke-ComposeServiceStop([string]$projectName, [string]$service) {
  if (-not (Test-DockerComposeAvailability)) { return $false }
  try {
    docker compose --project-name $projectName stop $service | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Invoke-ComposeServiceStart([string]$projectName, [string]$envFile, [string]$service, [bool]$build, [bool]$noBuild, [bool]$useBuildKit) {
  if (-not (Test-DockerComposeAvailability)) { return $false }
  $env:DOCKER_BUILDKIT = if ($useBuildKit) { "1" } else { "0" }
  $composeArgs = Get-ComposeEnvArg $projectName $envFile

  if ($build) {
    $buildArgs = $composeArgs + @("build", $service)
    & docker @buildArgs
    if ($LASTEXITCODE -ne 0) {
      return $false
    }
  }

  $upArgs = $composeArgs + @("up", "-d", $service)
  if ($noBuild) { $upArgs += "--no-build" }
  & docker @upArgs
  return $LASTEXITCODE -eq 0
}

function Resolve-PostgresContainerName([string]$composeProject) {
  $containerName = ""
  if (Test-DockerComposeAvailability) {
    try { $containerName = docker compose --project-name $composeProject ps --status running -q postgres } catch { $containerName = "" }
  }
  if (-not $containerName -and (Test-CommandAvailability "docker")) {
    try { $containerName = docker ps --filter "label=com.docker.compose.service=postgres" --format "{{.Names}}" | Select-Object -First 1 } catch { $containerName = "" }
  }
  return $containerName
}

function Resolve-DockerContainerByPort([int]$port, [string]$composeProject, [string]$serviceName) {
  if (!(Test-CommandAvailability "docker")) { return $false }
  $stoppedAny = $false

  if (Test-DockerComposeAvailability) {
    try {
      $containerId = docker compose --project-name $composeProject ps -q $serviceName
      if ($containerId) {
        docker compose --project-name $composeProject stop $serviceName | Out-Null
        $stoppedAny = $true
      }
    } catch {
      Write-Verbose "Failed to stop compose service '$serviceName' on project '$composeProject': $($_.Exception.Message)"
    }
  }

  try {
    $containers = docker ps --filter "publish=$port" --format "{{.Names}}"
    foreach ($name in $containers) {
      if ($name) {
        docker stop $name | Out-Null
        $stoppedAny = $true
      }
    }
  } catch {
    Write-Verbose "Failed to scan/stop docker containers published on port ${port}: $($_.Exception.Message)"
  }

  return $stoppedAny
}

function Initialize-SubqueryDbExtension([pscustomobject]$dbInfo, [string]$composeProject) {
  if (-not $dbInfo -or [string]::IsNullOrWhiteSpace($dbInfo.Host)) { return }
  if ($dbInfo.Host -notin @("localhost", "127.0.0.1")) { return }

  Write-Info "Ensuring SubQuery DB extensions..."
  $password = if ($dbInfo.Pass) { $dbInfo.Pass } else { "" }
  $user = if ($dbInfo.User) { $dbInfo.User } else { "postgres" }
  $dbName = if ($dbInfo.Database) { $dbInfo.Database } else { "postgres" }
  $extensionCmd = "CREATE EXTENSION IF NOT EXISTS btree_gist;"

  $handled = $false
  if (Test-DockerComposeAvailability) {
    try {
      $containerId = docker compose --project-name $composeProject ps -q postgres
      if ($containerId) {
        docker compose --project-name $composeProject exec -T -e PGPASSWORD=$password postgres `
          psql -U $user -d $dbName -c $extensionCmd | Out-Null
        $handled = $true
      }
    } catch { $handled = $false }
  }

  if (-not $handled -and (Test-CommandAvailability "docker")) {
    try {
      $containerName = Resolve-PostgresContainerName $composeProject
      if ($containerName) {
        docker exec -e PGPASSWORD=$password $containerName psql -U $user -d $dbName -c $extensionCmd | Out-Null
        $handled = $true
      }
    } catch { $handled = $false }
  }

  if (-not $handled) {
    Write-Warn "Failed to ensure btree_gist extension. You may need to enable it manually."
  }
}

function Wait-ForSubquerySchema([pscustomobject]$dbInfo, [string]$composeProject, [string]$schemaName, [int]$timeoutSeconds = 60) {
  if (-not $dbInfo -or [string]::IsNullOrWhiteSpace($dbInfo.Host)) { return $false }
  if ($dbInfo.Host -notin @("localhost", "127.0.0.1")) { return $false }

  $password = if ($dbInfo.Pass) { $dbInfo.Pass } else { "" }
  $user = if ($dbInfo.User) { $dbInfo.User } else { "postgres" }
  $dbName = if ($dbInfo.Database) { $dbInfo.Database } else { "postgres" }

  $containerName = Resolve-PostgresContainerName $composeProject
  if (-not $containerName) { return $false }

  for ($i = 0; $i -lt $timeoutSeconds; $i++) {
    try {
      $result = $null
      if ($containerName -match '^[a-f0-9]{12,}$') {
        $result = docker compose --project-name $composeProject exec -T -e PGPASSWORD=$password postgres `
          psql -U $user -d $dbName -tA -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = '$schemaName';"
      } else {
        $result = docker exec -e PGPASSWORD=$password $containerName `
          psql -U $user -d $dbName -tA -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = '$schemaName';"
      }
      if ($result -match $schemaName) { return $true }
    } catch {
      Write-Verbose "Waiting for schema '$schemaName' failed for this poll iteration: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 1
  }

  return $false
}

function Read-SubqueryMetadataValue([pscustomobject]$dbInfo, [string]$composeProject, [string]$schemaName, [string]$key) {
  if (-not $dbInfo) { return $null }
  $containerName = Resolve-PostgresContainerName $composeProject
  if (-not $containerName) { return $null }

  $password = if ($dbInfo.Pass) { $dbInfo.Pass } else { "" }
  $user = if ($dbInfo.User) { $dbInfo.User } else { "postgres" }
  $dbName = if ($dbInfo.Database) { $dbInfo.Database } else { "postgres" }

  $value = $null
  try {
    $schemaQuery = "SELECT schema_name FROM information_schema.schemata WHERE schema_name = '$schemaName';"
    $schemaExists = $false
    if ($containerName -match '^[a-f0-9]{12,}$') {
      $schemaResult = docker compose --project-name $composeProject exec -T -e PGPASSWORD=$password postgres `
        psql -U $user -d $dbName -tA -c $schemaQuery
    } else {
      $schemaResult = docker exec -e PGPASSWORD=$password $containerName `
        psql -U $user -d $dbName -tA -c $schemaQuery
    }
    if ($schemaResult -match $schemaName) { $schemaExists = $true }
    if (-not $schemaExists) { return $null }

    $query = "SELECT value FROM `"$schemaName`"._metadata WHERE key = '${key}' LIMIT 1;"
    if ($containerName -match '^[a-f0-9]{12,}$') {
      $value = $query | docker compose --project-name $composeProject exec -T -e PGPASSWORD=$password postgres `
        psql -U $user -d $dbName -tA
    } else {
      $value = $query | docker exec -i -e PGPASSWORD=$password $containerName `
        psql -U $user -d $dbName -tA
    }
  } catch {
    return $null
  }

  if ($null -eq $value) { return $null }
  $trimmed = $value.Trim()
  if ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) {
    $trimmed = $trimmed.Trim('"')
  }
  return $trimmed
}

function Get-ChainFinalizedHeight([string]$wsUrl) {
  if ([string]::IsNullOrWhiteSpace($wsUrl)) { return $null }
  if (!(Test-CommandAvailability "node")) { return $null }
  $script = @"
const { ApiPromise, WsProvider } = require('@polkadot/api');
(async () => {
  const api = await ApiPromise.create({ provider: new WsProvider('$wsUrl') });
  const head = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(head);
  console.log(header.number.toString());
  await api.disconnect();
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
"@
  try {
    $output = node -e $script 2>$null
  } catch {
    return $null
  }
  if ($LASTEXITCODE -ne 0) { return $null }
  $value = $output.Trim()
  if ($value -match '^\d+$') { return [int]$value }
  return $null
}

function Wait-ForChainFinalizedHeight([string]$wsUrl, [int]$minHeight = 1, [int]$timeoutSeconds = 60) {
  if ([string]::IsNullOrWhiteSpace($wsUrl)) { return $false }

  for ($i = 0; $i -lt $timeoutSeconds; $i++) {
    $height = Get-ChainFinalizedHeight $wsUrl
    if ($null -ne $height -and $height -ge $minHeight) {
      return $true
    }
    Start-Sleep -Seconds 1
  }

  return $false
}

function Export-ChainMetadata([int]$retries = 15, [int]$delaySeconds = 2) {
  if (!(Test-CommandAvailability "npm")) {
    Write-Warn "npm not found. Skipping chain metadata export."
    return $false
  }

  for ($attempt = 1; $attempt -le $retries; $attempt++) {
    Write-Info "Exporting chain metadata (attempt $attempt/$retries)..."
    npm run chain:metadata:apply
    if ($LASTEXITCODE -eq 0) { return $true }
    Start-Sleep -Seconds $delaySeconds
  }

  Write-Warn "Chain metadata export failed. You can retry with: npm run chain:metadata:apply"
  return $false
}

# ---- Setup ----
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectRoot = $root.Path
Set-Location $root

$composeProject = if ($env:COMPOSE_PROJECT_NAME) { $env:COMPOSE_PROJECT_NAME } else { "remitchain" }
$envFile = Join-Path $root ".env.local"

Initialize-EnvFile ".env.local" ".env.example"
Initialize-EnvFile "services/relayer/.env" "services/relayer/.env.example"
Initialize-EnvFile "subquery/.env" "subquery/.env.example"

Use-EnvMap (Read-EnvFile ".env.local")
Use-EnvMap (Read-EnvFile "services/relayer/.env")
Use-EnvMap (Read-EnvFile "subquery/.env")

if ($env:CHAIN_WS_URL -and -not $env:SUBQUERY_ENDPOINT) {
  Set-Item -Path "Env:SUBQUERY_ENDPOINT" -Value $env:CHAIN_WS_URL
}

$script:ParsedDb = $null
if ($env:DATABASE_URL) {
  $script:ParsedDb = ConvertFrom-DatabaseUrl $env:DATABASE_URL
  if ($script:ParsedDb) {
    Use-EnvIfMissing "DB_HOST" $script:ParsedDb.Host
    Use-EnvIfMissing "DB_PORT" $script:ParsedDb.Port
    Use-EnvIfMissing "DB_USER" $script:ParsedDb.User
    Use-EnvIfMissing "DB_PASS" $script:ParsedDb.Pass
    Use-EnvIfMissing "DB_DATABASE" $script:ParsedDb.Database
  }
}

# Required by SubQuery.
$env:TZ = "UTC"

# Use cmd.exe for npm scripts to avoid PowerShell parsing issues.
$env:npm_config_script_shell = $env:ComSpec

if ($ChainCommand -ne "") { $env:CHAIN_COMMAND = $ChainCommand }

# ---- Pre-clean ----
if ($Clean) {
  Write-Info "Clean mode enabled. Stopping project services and local project processes..."

  $chainWsPortForCleanup = Get-UriPort $env:CHAIN_WS_URL 9944
  $redisPortForCleanup = Resolve-EnvPort $env:REDIS_PORT 6379
  if ($env:REDIS_URL) {
    $redisUriForCleanup = $null
    if ([System.Uri]::TryCreate($env:REDIS_URL, [System.UriKind]::Absolute, [ref]$redisUriForCleanup)) {
      if ($redisUriForCleanup.Port -gt 0) {
        $redisPortForCleanup = $redisUriForCleanup.Port
      }
    }
  }
  $dbPortForCleanup = if ($script:ParsedDb -and $script:ParsedDb.Port) { [int]$script:ParsedDb.Port } else { Resolve-EnvPort $env:DB_PORT 5432 }
  $relayerPortForCleanup = Resolve-EnvPort $env:RELAYER_PORT 8787
  $webPortSource = if ($env:NEXT_PORT) { $env:NEXT_PORT } else { $env:PORT }
  $webPortForCleanup = Resolve-EnvPort $webPortSource 3000
  $subqueryQueryPortForCleanup = Resolve-EnvPort $env:SUBQUERY_QUERY_PORT 3001
  $subqueryNodePortForCleanup = Resolve-EnvPort $env:SUBQUERY_NODE_PORT 3000
  if ($subqueryNodePortForCleanup -eq $subqueryQueryPortForCleanup) {
    $subqueryNodePortForCleanup = if ($subqueryQueryPortForCleanup -eq 3000) { 3002 } else { 3000 }
  }

  Write-Info "Clean mode skips docker compose down/stop; native docker compose up handles containers."

  $subqueryDirForCleanup = Join-Path $root "subquery"
  Resolve-ProcessByCommandTokenMatch "subql-node" $subqueryDirForCleanup "SubQuery node" | Out-Null
  Resolve-ProcessByCommandTokenMatch "subql-query" $subqueryDirForCleanup "SubQuery query" | Out-Null

  $cleanupPorts = @(
    [int]$chainWsPortForCleanup,
    [int]$redisPortForCleanup,
    [int]$dbPortForCleanup,
    [int]$relayerPortForCleanup,
    [int]$webPortForCleanup,
    [int]$subqueryNodePortForCleanup,
    [int]$subqueryQueryPortForCleanup
  ) | Sort-Object -Unique

  $cleanupPortLabels = @{}
  $cleanupPortLabelPairs = @(
    [pscustomobject]@{ Port = [int]$chainWsPortForCleanup; Label = "Chain" },
    [pscustomobject]@{ Port = [int]$redisPortForCleanup; Label = "Redis" },
    [pscustomobject]@{ Port = [int]$dbPortForCleanup; Label = "Postgres" },
    [pscustomobject]@{ Port = [int]$relayerPortForCleanup; Label = "Relayer" },
    [pscustomobject]@{ Port = [int]$webPortForCleanup; Label = "Web" },
    [pscustomobject]@{ Port = [int]$subqueryNodePortForCleanup; Label = "SubQuery Node" },
    [pscustomobject]@{ Port = [int]$subqueryQueryPortForCleanup; Label = "SubQuery Query" }
  )
  foreach ($pair in $cleanupPortLabelPairs) {
    if ($pair.Port -le 0) { continue }
    $key = "$($pair.Port)"
    if (-not $cleanupPortLabels.ContainsKey($key)) {
      $cleanupPortLabels[$key] = $pair.Label
    }
  }

  foreach ($port in $cleanupPorts) {
    if ($port -le 0 -or -not (Test-PortInUse $port)) { continue }
    $label = if ($cleanupPortLabels.ContainsKey("$port")) { $cleanupPortLabels["$port"] } else { "Service" }
    $stopped = Resolve-ProcessByPortIfOwned $port $label $projectRoot
    if (-not $stopped -and $port -eq $chainWsPortForCleanup) {
      $stopped = Resolve-ProcessByPortIfPatternMatch $port @("remitchain", "substrate", "polkadot", "node-template") "Chain"
    }
    if ($stopped) { Wait-For-PortFree $port 20 | Out-Null }
    if (Test-PortInUse $port) {
      Write-Warn "$label port $port is still in use after clean step."
    }
  }
}

# ---- Docker services (Redis/Postgres) ----
try {
  if (!$SkipRedis -and $env:REDIS_URL) {
    $redisUri = $null
    $redisHost = "localhost"
    $redisPort = 6379
    if ([System.Uri]::TryCreate($env:REDIS_URL, [System.UriKind]::Absolute, [ref]$redisUri)) {
      $redisHost = $redisUri.Host
      if ($redisUri.Port -gt 0) { $redisPort = $redisUri.Port }
    }

    if (Test-LocalHost $redisHost) {
      if (Test-PortInUse $redisPort) {
        Write-Info "Redis port $redisPort already in use. Skipping Docker Redis."
      } elseif (Test-DockerComposeAvailability) {
        Invoke-ComposeServiceStart $composeProject $envFile "redis" $false $false $true | Out-Null
        Write-Info "Started Redis via docker compose."
      } else {
        Write-Warn "Docker compose not available. Skipping Redis startup."
      }
    } else {
      Write-Info "REDIS_URL host not local. Skipping Docker Redis."
    }
  }
} catch { Write-Warn "Redis startup failed: $($_.Exception.Message)" }

try {
  if (!$SkipPostgres -and $env:DATABASE_URL) {
    $dbInfo = $script:ParsedDb
    if ($dbInfo -and (Test-LocalHost $dbInfo.Host)) {
      if (Test-PortInUse $dbInfo.Port) {
        Write-Info "Postgres port $($dbInfo.Port) already in use. Skipping Docker Postgres."
      } elseif (Test-DockerComposeAvailability) {
        $env:POSTGRES_USER = $dbInfo.User
        $env:POSTGRES_PASSWORD = $dbInfo.Pass
        $env:POSTGRES_DB = $dbInfo.Database
        $env:POSTGRES_PORT = $dbInfo.Port
        Invoke-ComposeServiceStart $composeProject $envFile "postgres" $false $false $true | Out-Null
        Write-Info "Started Postgres via docker compose."
      } else {
        Write-Warn "Docker compose not available. Skipping Postgres startup."
      }
    } else {
      Write-Info "DATABASE_URL host not local. Skipping Docker Postgres."
    }
  }
} catch { Write-Warn "Postgres startup failed: $($_.Exception.Message)" }

# ---- Chain ----
$chainWsUrl = $env:CHAIN_WS_URL
$chainWsHost = Get-UriHost $chainWsUrl
$chainWsPort = Get-UriPort $chainWsUrl 9944
$chainWsIsLocal = Test-LocalHost $chainWsHost
$chainPortInUse = $chainWsIsLocal -and (Test-PortInUse $chainWsPort)
$script:ChainStarted = $false

$useDockerChain = $ChainDocker
if (-not $useDockerChain -and $env:CHAIN_DOCKER) {
  $value = $env:CHAIN_DOCKER.ToLowerInvariant()
  $useDockerChain = $value -in @('1', 'true', 'yes')
}

if ($useDockerChain) {
  $chainComposeRunning = Test-ComposeServiceRunning $composeProject "chain"
  if ($chainPortInUse -and $chainComposeRunning) {
    Write-Info "Chain compose service already running on port $chainWsPort. Reusing existing container."
    $chainPortInUse = $false
  }

  if ($chainPortInUse) {
    Write-Info "Chain WS port $chainWsPort already in use. Attempting to stop existing chain containers..."
    $stopped = Resolve-DockerContainerByPort $chainWsPort $composeProject "chain"
    if (-not $stopped) {
      $stopped = Resolve-ProcessByPortIfPatternMatch $chainWsPort @("remitchain", "substrate", "polkadot", "node-template") "Chain"
    }
    Start-Sleep -Seconds 2
    $chainPortInUse = Test-PortInUse $chainWsPort
    if ($chainPortInUse -and $stopped) {
      Write-Info "Waiting for chain port $chainWsPort to close..."
      $closed = Wait-For-PortFree $chainWsPort 20
      if ($closed) {
        $chainPortInUse = $false
      }
    }
    if ($chainPortInUse) {
      Write-Warn "Chain WS port $chainWsPort still in use. Skipping Docker chain start."
    }
  }

  if (-not $chainPortInUse) {
    if ($chainComposeRunning -or (Test-ComposeServiceRunning $composeProject "chain")) {
      Write-Info "Chain container already running. Skipping Docker chain start."
    } else {
      Write-Info "Starting chain in Docker..."

      $useRebuild = $ChainDockerRebuild
      if (-not $useRebuild -and $env:CHAIN_DOCKER_REBUILD) {
        $value = $env:CHAIN_DOCKER_REBUILD.ToLowerInvariant()
        $useRebuild = $value -in @('1', 'true', 'yes')
      }

      $useNoBuild = $ChainDockerNoBuild
      if (-not $useNoBuild -and $env:CHAIN_DOCKER_NO_BUILD) {
        $value = $env:CHAIN_DOCKER_NO_BUILD.ToLowerInvariant()
        $useNoBuild = $value -in @('1', 'true', 'yes')
      }

      $useNoBuildKit = $ChainDockerNoBuildKit
      if (-not $useNoBuildKit -and -not $useRebuild -and $env:CHAIN_DOCKER_NO_BUILDKIT) {
        $value = $env:CHAIN_DOCKER_NO_BUILDKIT.ToLowerInvariant()
        $useNoBuildKit = $value -in @('1', 'true', 'yes')
      }

      if (Test-DockerComposeAvailability) {
        Write-Info "Starting chain via native docker compose..."
        $chainStarted = Invoke-ComposeServiceStart $composeProject $envFile "chain" $useRebuild $useNoBuild (-not $useNoBuildKit)
        if ($chainStarted) {
          $script:ChainStarted = $true
        } else {
          Write-Warn "Native docker compose failed to start chain service."
        }
      } else {
        Write-Info "Docker compose not available. Falling back to helper startup script."
        $dockerArgs = @()
        if ($useRebuild) { $dockerArgs += "-Rebuild" }
        if ($useNoBuild) { $dockerArgs += "-NoBuild" }
        if ($useNoBuildKit) { $dockerArgs += "-NoBuildKit" }

        & (Join-Path $root "scripts/start-chain-docker.ps1") @dockerArgs
        if ($LASTEXITCODE -eq 0) {
          $script:ChainStarted = $true
        } else {
          Write-Warn "Helper chain startup failed with exit code $LASTEXITCODE."
        }
      }
    }
  }
} elseif ($env:CHAIN_COMMAND) {
  if ($chainPortInUse) {
    Write-Info "Chain WS port $chainWsPort already in use. Skipping CHAIN_COMMAND."
  } else {
    Write-Info "Starting chain: $($env:CHAIN_COMMAND)"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $env:CHAIN_COMMAND -WorkingDirectory $root
    $script:ChainStarted = $true
  }
} else {
  Write-Warn "CHAIN_COMMAND not set. Start your chain manually."
}

# ---- Chain metadata ----
if ($env:CHAIN_WS_URL) {
  if ($script:ChainStarted) {
    Write-Info "Waiting for chain RPC to warm up..."
    if (-not (Wait-For-PortOpen $chainWsPort 20)) {
      Write-Warn "Chain WS port $chainWsPort not reachable yet. Skipping metadata export."
    } else {
      Start-Sleep -Seconds 4
    }
  }
  if (-not $chainWsIsLocal -or (Test-PortInUse $chainWsPort)) {
    Export-ChainMetadata | Out-Null
  } else {
    Write-Info "Chain WS not reachable yet. Skipping metadata export."
  }
}

# ---- Relayer ----
try {
  $relayerDir = Join-Path $root "services/relayer"
  $relayerBin = Join-Path $relayerDir "node_modules/.bin/tsx"
  if (!(Test-Path $relayerBin)) {
    Write-Info "Installing relayer dependencies..."
    Push-Location $relayerDir
    npm install
    Pop-Location
  }

  $relayerPort = 8787
  if ($env:RELAYER_PORT) { [int]::TryParse($env:RELAYER_PORT, [ref]$relayerPort) | Out-Null }
  if (Test-PortInUse $relayerPort) {
    $stopped = Resolve-ProcessByPortIfOwned $relayerPort "Relayer" $projectRoot
    if (-not $stopped) {
      Write-Warn "Relayer port $relayerPort already in use. Skipping relayer start."
      $relayerPort = 0
    }
  }

  if ($relayerPort -ne 0) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory $relayerDir
  }
} catch { Write-Warn "Relayer start failed: $($_.Exception.Message)" }

# ---- Prisma ----
try {
  if ($env:DATABASE_URL) {
    Write-Info "Preparing Prisma client..."
    npm run prisma:generate

    $migrationsDir = Join-Path $root "prisma/migrations"
    if (Test-Path $migrationsDir) {
      Write-Info "Applying Prisma migrations..."
      npm run prisma:deploy
    } else {
      Write-Info "Initializing Prisma migrations..."
      npm run prisma:migrate -- --name init
    }

    if ($script:ParsedDb) {
      Initialize-SubqueryDbExtension $script:ParsedDb $composeProject
    }
  } else {
    Write-Warn "DATABASE_URL not set. Skipping Prisma."
  }
} catch { Write-Warn "Prisma step failed: $($_.Exception.Message)" }

# ---- Web ----
try {
  $webBin = Join-Path $root "node_modules/.bin/next"
  if (!(Test-Path $webBin)) {
    Write-Info "Installing web dependencies..."
    npm install
  }

  $webPort = 3000
  if ($env:NEXT_PORT) {
    [int]::TryParse($env:NEXT_PORT, [ref]$webPort) | Out-Null
  } elseif ($env:PORT) {
    [int]::TryParse($env:PORT, [ref]$webPort) | Out-Null
  }

  if (Test-PortInUse $webPort) {
    $stopped = Resolve-ProcessByPortIfOwned $webPort "Web" $projectRoot
    if (-not $stopped) {
      Write-Warn "Web port $webPort already in use. Skipping web start."
      $webPort = 0
    }
  }

  if ($webPort -ne 0) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory $root
  }
} catch { Write-Warn "Web start failed: $($_.Exception.Message)" }

# ---- SubQuery ----
if (-not $SkipSubquery) {
  try {
    $subqueryDir = Join-Path $root "subquery"
    $subqlNodeRunning = Test-CommandLineRunning "subql-node" $subqueryDir
    $subqlQueryRunning = Test-CommandLineRunning "subql-query" $subqueryDir

    if ($subqlNodeRunning -and $subqlQueryRunning) {
      Write-Info "SubQuery already running. Skipping SubQuery start."
    } else {
      if (!(Test-Path (Join-Path $subqueryDir "node_modules"))) {
        Write-Info "Installing SubQuery dependencies..."
        Push-Location $subqueryDir
        npm install
        Pop-Location
      }

      $subqlBin = Join-Path $subqueryDir "node_modules/.bin/subql.cmd"
      $subqlNodeBin = Join-Path $subqueryDir "node_modules/.bin/subql-node.cmd"
      $subqlQueryBin = Join-Path $subqueryDir "node_modules/.bin/subql-query.cmd"

      if (!(Test-Path $subqlBin) -or !(Test-Path $subqlNodeBin) -or !(Test-Path $subqlQueryBin)) {
        Write-Warn "SubQuery CLI not found after install. Install @subql/cli, @subql/node, and @subql/query."
      } else {
        Push-Location $subqueryDir
        & $subqlBin codegen project.yaml 2>&1 | ForEach-Object { Write-Info "$_" }
        if ($LASTEXITCODE -ne 0) {
          Pop-Location
          throw "SubQuery codegen failed with exit code $LASTEXITCODE."
        }
        & $subqlBin build project.yaml 2>&1 | ForEach-Object { Write-Info "$_" }
        if ($LASTEXITCODE -ne 0) {
          Pop-Location
          throw "SubQuery build failed with exit code $LASTEXITCODE."
        }
        Pop-Location

        $queryPort = 3001
        if ($env:SUBQUERY_QUERY_PORT) { [int]::TryParse($env:SUBQUERY_QUERY_PORT, [ref]$queryPort) | Out-Null }
        $nodePort = 3000
        if ($env:SUBQUERY_NODE_PORT) { [int]::TryParse($env:SUBQUERY_NODE_PORT, [ref]$nodePort) | Out-Null }
        if ($nodePort -eq $queryPort) {
          $fallbackNodePort = if ($queryPort -eq 3000) { 3002 } else { 3000 }
          Write-Warn "SUBQUERY_NODE_PORT ($nodePort) matches SUBQUERY_QUERY_PORT ($queryPort). Using node port $fallbackNodePort."
          $nodePort = $fallbackNodePort
        }
        $subqueryName = if ($env:SUBQUERY_NAME) { $env:SUBQUERY_NAME } else { "remitchain-indexer" }

        if (-not $subqlNodeRunning) {
          $projectFile = Join-Path $subqueryDir "project.yaml"
          $chainReadyForSubquery = Wait-ForChainFinalizedHeight $env:CHAIN_WS_URL 1 60
          if (-not $chainReadyForSubquery) {
            Write-Warn "Chain finalized height did not reach 1 in time. Skipping SubQuery node start to avoid genesis timestamp assertion."
            Write-Info "Once chain is producing blocks, re-run: npm run start:node --prefix subquery"
            $subqlNodeRunning = $false
          } else {
            if ($script:ParsedDb) {
              $lastProcessed = Read-SubqueryMetadataValue $script:ParsedDb $composeProject $subqueryName "lastProcessedHeight"
              $chainHead = Get-ChainFinalizedHeight $env:CHAIN_WS_URL
              if ($lastProcessed -and $null -ne $chainHead) {
                $lastValue = 0
                [int]::TryParse($lastProcessed, [ref]$lastValue) | Out-Null
                if ($lastValue -gt $chainHead) {
                  Write-Warn "SubQuery DB height ($lastValue) is ahead of chain head ($chainHead). Running force-clean..."
                  & $subqlNodeBin run force-clean -f $projectFile --db-schema $subqueryName 2>&1 | ForEach-Object { Write-Info "$_" }
                  if ($LASTEXITCODE -ne 0) {
                    Write-Warn "SubQuery force-clean failed with exit code $LASTEXITCODE. Continuing startup."
                  }
                }
              }
            }

            $nodePortReady = $true
            if (Test-PortInUse $nodePort) {
              $nodePortReady = Resolve-ProcessByPortIfOwned $nodePort "SubQuery Node" $projectRoot
              if (-not $nodePortReady) {
                Write-Warn "SubQuery node port $nodePort already in use. Skipping SubQuery node start."
              }
            }

            if ($nodePortReady) {
              Start-Process powershell -ArgumentList "-NoExit", "-Command", "`"$subqlNodeBin`" -f `"$projectFile`" --db-schema `"$subqueryName`" --port $nodePort" -WorkingDirectory $subqueryDir
              $subqlNodeRunning = Wait-ForProcess "subql-node" $subqueryDir 45
              if (-not $subqlNodeRunning) {
                Write-Warn "SubQuery node did not start within timeout. Skipping SubQuery query."
              }
            }
          }
        } else {
          Write-Info "SubQuery node already running."
        }

        if (-not $subqlQueryRunning -and $subqlNodeRunning) {
          $queryPortInUse = Test-PortInUse $queryPort
          if (-not $queryPortInUse -or (Resolve-ProcessByPortIfOwned $queryPort "SubQuery Query" $projectRoot)) {
            if ($script:ParsedDb) {
              $schemaReady = Wait-ForSubquerySchema $script:ParsedDb $composeProject $subqueryName 60
              if (-not $schemaReady) {
                Write-Warn "SubQuery schema not ready yet. Skipping SubQuery query."
                Write-Info "Re-run: npm run start:query --prefix subquery"
              }
            }
            if (-not $script:ParsedDb -or $schemaReady) {
              Start-Process powershell -ArgumentList "-NoExit", "-Command", "`"$subqlQueryBin`" --name `"$subqueryName`" --port $queryPort" -WorkingDirectory $subqueryDir
            }
          } else {
            Write-Warn "SubQuery query port $queryPort already in use. Skipping SubQuery query."
          }
        } elseif ($subqlQueryRunning) {
          Write-Info "SubQuery query already running."
        }
      }
    }
  } catch { Write-Warn "SubQuery start failed: $($_.Exception.Message)" }
}

Write-Info "All services started."
