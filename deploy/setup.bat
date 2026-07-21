@echo off
rem Double-click this to run deploy\setup.ps1 elevated (it needs
rem Administrator rights to install the Windows Service and firewall rule).
rem The elevated window stays open (-NoExit) so you can read the summary.
setlocal
set SCRIPT_DIR=%~dp0
powershell -NoProfile -Command "Start-Process powershell -ArgumentList '-NoExit -NoProfile -ExecutionPolicy Bypass -File \"%SCRIPT_DIR%setup.ps1\"' -Verb RunAs"
