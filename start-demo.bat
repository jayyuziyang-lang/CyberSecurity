@echo off
REM ============================================================================
REM  start-demo.bat -- DOUBLE-CLICK THIS FILE TO START THE DEMO
REM ----------------------------------------------------------------------------
REM  It does one thing: launches start-demo.ps1 from this same folder
REM  with the right flags.
REM
REM  Why a .bat wrapper is needed:
REM    * .ps1 cannot be double-clicked reliably (execution policy blocks it,
REM      or Windows opens it in Notepad instead of running it)
REM    * .bat runs normally on double-click and can bypass the execution
REM      policy, so the user never has to change system settings
REM
REM  ENCODING NOTE -- DO NOT "FIX" THIS FILE:
REM    This file is intentionally ASCII-only (no Chinese text).
REM    cmd.exe reads .bat files using the system ANSI codepage; a .bat saved
REM    as UTF-8 lets non-ASCII text break the parser. All Chinese messaging
REM    lives in start-demo.ps1, which is UTF-8 *with* BOM and loads correctly.
REM ============================================================================

setlocal

cd /d "%~dp0"
title Cybersec Demo Launcher

if not exist "%~dp0start-demo.ps1" (
    echo.
    echo  [ERROR] start-demo.ps1 not found.
    echo          Make sure start-demo.bat and start-demo.ps1 are in the same folder.
    echo.
    pause
    exit /b 1
)

REM chcp 65001 so the Chinese output produced by PowerShell renders correctly
chcp 65001 >nul 2>&1

REM No -Wait here: powershell with -File blocks until the script finishes,
REM so this console stays open and shows all output. Adding -Wait would be
REM rejected as an unknown parameter.
REM -NoProfile avoids interference from the user's PowerShell profile
REM -ExecutionPolicy Bypass means the user does not have to change system settings
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"

set RC=%ERRORLEVEL%

if not "%RC%"=="0" (
    echo.
    echo  [NOTE] Something went wrong. Please screenshot the messages above.
    echo.
    pause
)

endlocal
exit /b %RC%
