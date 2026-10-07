@echo off
REM ============================================================================
REM  push-github.bat -- Push this project to GitHub (double-click to run)
REM ----------------------------------------------------------------------------
REM  Made for the case where "git push" fails on a mainland-China network:
REM      fatal: unable to access ... Failed to connect to github.com port 443
REM      schannel: failed to receive handshake, SSL/TLS connection failed
REM
REM  It tries four methods in order and stops at the first that works:
REM      1. configure git to use the system proxy, then push
REM      2. drop the proxy and switch to the bundled OpenSSL backend, then push
REM      3. try SSH (works if you have a key configured)
REM      4. fall back to uploading file-by-file via the GitHub API (slowest,
REM         but it goes through a different network path so it usually works)
REM
REM  ENCODING NOTE: this file is ASCII-only ON PURPOSE. cmd.exe parses .bat
REM  files using the system ANSI codepage, and non-ASCII text here can break
REM  the parser. All Chinese messages live in the .ps1 files and docs instead.
REM ============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"
title Push to GitHub

chcp 65001 >nul 2>&1

echo.
echo  ============================================================
echo    Pushing to GitHub
echo  ============================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] git not found. Install Git for Windows first.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('git remote get-url origin 2^>nul') do set "REMOTE=%%i"
if "%REMOTE%"=="" (
    echo  [ERROR] No git remote named "origin".
    echo          Run this to add one:
    echo            git remote add origin https://github.com/USER/REPO.git
    pause
    exit /b 1
)
echo  Remote: %REMOTE%
echo.

echo  [1/4] Trying with system proxy (127.0.0.1:7890)...
git config http.proxy http://127.0.0.1:7890
git config https.proxy http://127.0.0.1:7890
git push -u origin main 2>nul
if not errorlevel 1 goto success

echo  [2/4] Trying direct connection with OpenSSL backend...
git config --unset http.proxy           2>nul
git config --unset https.proxy          2>nul
git config http.sslBackend openssl
git push -u origin main 2>nul
if not errorlevel 1 goto success

echo  [3/4] Trying SSH...
git config http.sslBackend schannel
git remote set-url origin git@github.com:jayyuziyang-lang/CyberSecurity.git
git push -u origin main 2>nul
if not errorlevel 1 goto success

echo  [4/4] Falling back to GitHub API upload...
echo        (uploads file contents; local git history is not pushed)
git remote set-url origin %REMOTE%
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found, cannot use the API fallback.
    goto failed
)
node tools\push-via-api.js jayyuziyang-lang/CyberSecurity main
if not errorlevel 1 goto success

:failed
echo.
echo  ============================================================
echo    ALL METHODS FAILED
echo  ============================================================
echo.
echo  Try these:
echo    1. Turn your VPN/proxy ON, then run this again
echo    2. Or upload manually at:
echo       https://github.com/jayyuziyang-lang/CyberSecurity/upload/main
echo.
pause
exit /b 1

:success
echo.
echo  ============================================================
echo    DONE - pushed successfully
echo  ============================================================
echo.
echo    https://github.com/jayyuziyang-lang/CyberSecurity
echo.
pause
exit /b 0
