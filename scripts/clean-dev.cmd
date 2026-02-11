@echo off
setlocal

set "ROOT=%~dp0.."
pushd "%ROOT%" || exit /b 1

echo Cleaning workspace...
call :rmdir "node_modules"
call :del "package-lock.json"
call :rmdir ".next"
call :rmdir "services\\relayer\\node_modules"
call :del "services\\relayer\\package-lock.json"
call :rmdir "subquery\\node_modules"
call :del "subquery\\package-lock.json"

echo Starting dev services...
call "%~dp0start-dev.cmd" %*

popd
exit /b 0

:rmdir
if exist "%~1" (
  echo Removing %~1
  rmdir /s /q "%~1"
)
exit /b 0

:del
if exist "%~1" (
  echo Deleting %~1
  del /f /q "%~1"
)
exit /b 0
