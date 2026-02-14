@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-chain-docker.ps1" %*
