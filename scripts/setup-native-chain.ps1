param(
  [switch]$Install,
  [switch]$Release
)

$ErrorActionPreference = "Stop"

function Has-Command([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-WingetPackage([string]$id, [string]$name) {
  if (!(Has-Command "winget")) {
    Write-Host "winget not available. Install $name manually."
    return $false
  }

  Write-Host "Installing $name ($id) via winget..."
  winget install --id $id --silent --accept-source-agreements --accept-package-agreements
  return $LASTEXITCODE -eq 0
}

function Get-VsWherePath() {
  $vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswhere) {
    return $vswhere
  }
  return $null
}

function Import-VsEnv() {
  $vswhere = Get-VsWherePath
  if (-not $vswhere) {
    Write-Host "vswhere not found. Visual Studio Build Tools may be missing."
    return $false
  }

  $installPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if (-not $installPath) {
    Write-Host "Visual Studio Build Tools not detected."
    return $false
  }

  $vcvars = Join-Path $installPath "VC\Auxiliary\Build\vcvars64.bat"
  if (!(Test-Path $vcvars)) {
    Write-Host "vcvars64.bat not found at $vcvars"
    return $false
  }

  $envLines = cmd /c "`"$vcvars`" >nul && set"
  foreach ($line in $envLines) {
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
      [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1])
      Set-Item -Path "Env:$($parts[0])" -Value $parts[1]
    }
  }

  return $true
}

function Ensure-LlvmEnv() {
  $llvmConfig = $env:LLVM_CONFIG_PATH
  $libclangDir = $env:LIBCLANG_PATH

  if (-not $llvmConfig) {
    $llvmCmd = Get-Command llvm-config -ErrorAction SilentlyContinue
    if ($llvmCmd) {
      $llvmConfig = $llvmCmd.Source
    }
  }

  if (-not $llvmConfig) {
    $defaultConfig = "C:\Program Files\LLVM\bin\llvm-config.exe"
    if (Test-Path $defaultConfig) {
      $llvmConfig = $defaultConfig
    }
  }

  if (-not $llvmConfig) {
    # Fallback to Android NDK LLVM if present.
    $ndkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk\ndk"
    if (Test-Path $ndkRoot) {
      $ndkBins = Get-ChildItem -Path $ndkRoot -Filter llvm-config.exe -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
      if ($ndkBins) {
        $llvmConfig = $ndkBins
      }
    }
  }

  if (-not $libclangDir) {
    $defaultLibclang = "C:\Program Files\LLVM\bin"
    if (Test-Path (Join-Path $defaultLibclang "libclang.dll")) {
      $libclangDir = $defaultLibclang
    }
  }

  if (-not $libclangDir) {
    $candidateRoots = @(
      "C:\Program Files\LLVM\bin",
      "C:\Program Files (x86)\LLVM\bin",
      (Join-Path $env:LOCALAPPDATA "Android\Sdk\ndk")
    )

    foreach ($root in $candidateRoots) {
      if (-not (Test-Path $root)) { continue }
      $match = Get-ChildItem -Path $root -Filter libclang.dll -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
      if ($match) {
        $libclangDir = Split-Path -Parent $match
        break
      }
    }
  }

  if ($llvmConfig -and (Test-Path $llvmConfig)) {
    $env:LLVM_CONFIG_PATH = $llvmConfig
  }

  if ($libclangDir -and (Test-Path (Join-Path $libclangDir "libclang.dll"))) {
    $env:LIBCLANG_PATH = $libclangDir
  }

  if ($env:LLVM_CONFIG_PATH -and $env:LIBCLANG_PATH) {
    if ($env:PATH -notlike "*$($env:LIBCLANG_PATH)*") {
      $env:PATH = "$($env:LIBCLANG_PATH);$env:PATH"
    }
    Write-Host "LLVM_CONFIG_PATH=$($env:LLVM_CONFIG_PATH)"
    Write-Host "LIBCLANG_PATH=$($env:LIBCLANG_PATH)"
    return $true
  }

  Write-Host "LLVM not found. Install LLVM and ensure llvm-config.exe is available."
  return $false
}

if (!(Has-Command "cargo")) {
  Write-Host "Rust (cargo) not found. Install Rust first."
  exit 1
}

if (!(Has-Command "cmake")) {
  Write-Host "CMake not found. Install CMake first."
  if ($Install) {
    Ensure-WingetPackage "Kitware.CMake" "CMake" | Out-Null
  }
}

if (-not (Get-VsWherePath)) {
  if ($Install) {
    Ensure-WingetPackage "Microsoft.VisualStudio.2022.BuildTools" "Visual Studio Build Tools" | Out-Null
  }
}

if (-not (Test-Path "C:\Program Files\LLVM\bin\llvm-config.exe")) {
  if ($Install) {
    Ensure-WingetPackage "LLVM.LLVM" "LLVM" | Out-Null
  }
}

if ($Install -and !(Has-Command "ninja")) {
  Ensure-WingetPackage "Ninja-build.Ninja" "Ninja" | Out-Null
}

if (-not (Import-VsEnv)) {
  Write-Host "Build Tools environment not ready. Aborting."
  exit 1
}

if (-not (Ensure-LlvmEnv)) {
  Write-Host "LLVM environment not ready. Aborting."
  exit 1
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$chainDir = Join-Path $root "chain"
Set-Location $chainDir

Write-Host "Cleaning librocksdb-sys..."
cargo clean -p librocksdb-sys

Write-Host "Building minimal-template-node..."
if ($Release) {
  cargo build -p minimal-template-node --release
} else {
  cargo build -p minimal-template-node
}

if ($LASTEXITCODE -ne 0) {
  Write-Host "Native build failed."
  exit $LASTEXITCODE
}

Write-Host "Native build succeeded."
