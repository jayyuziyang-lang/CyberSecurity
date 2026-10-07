@echo off
REM ============================================================================
REM  reset-demo.bat -- DOUBLE-CLICK TO RESET DEMO DATA
REM ----------------------------------------------------------------------------
REM  Restores the database to its initial demo state:
REM    - wipes answer records / mastery scores / signups / reports
REM    - re-inserts the seed data
REM
REM  Use it after a demo (or if you experimented too much) so the next demo
REM  starts from exactly the same state.
REM
REM  ENCODING NOTE: ASCII-only on purpose. cmd.exe parses .bat with the system
REM  ANSI codepage; non-ASCII here would risk breaking the parser. All Chinese
REM  messages live in db\reset-demo.sql, which PowerShell/psql handle as UTF-8.
REM ============================================================================

setlocal
cd /d "%~dp0"
title Reset Demo Data

chcp 65001 >nul 2>&1

REM Locate PostgreSQL binaries: prefer the portable one set up by start-demo.bat
set "PGBIN=%USERPROFILE%\pgsql-portable\bin"
if not exist "%PGBIN%\psql.exe" (
    echo.
    echo  [ERROR] PostgreSQL not found at:
    echo          %PGBIN%
    echo.
    echo          Run start-demo.bat first - it sets PostgreSQL up automatically.
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo    Resetting demo data
echo  ============================================================
echo.

set PGPASSWORD=123456
set PGCLIENTENCODING=UTF8

REM Make sure the database server is up; start it quietly if not
"%PGBIN%\pg_ctl.exe" -D "%USERPROFILE%\pgdata_cybersec" status >nul 2>&1
if errorlevel 1 (
    echo  Starting PostgreSQL...
    start "" /b "%PGBIN%\pg_ctl.exe" -D "%USERPROFILE%\pgdata_cybersec" -l "%USERPROFILE%\pgdata_cybersec_server.log" -o "-p 5432" start
    timeout /t 8 /nobreak >nul
)

"%PGBIN%\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d cybersec_db -v ON_ERROR_STOP=1 -f "%~dp0db\reset-demo.sql"
if errorlevel 1 goto failed

"%PGBIN%\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d cybersec_db -v ON_ERROR_STOP=1 -f "%~dp0db\seed.sql"
if errorlevel 1 goto failed
echo.
echo  ============================================================
echo    DONE - demo data has been reset
echo  ============================================================
echo.
echo    Open http://127.0.0.1:8081/ and log in as:
echo       student1 / 123456
echo.
echo    Expected: mastery 33.33  (2 weak / 0 basic / 1 proficient)
echo.
set PGPASSWORD=
pause
exit /b 0

:failed
echo.
echo  [ERROR] Reset failed. Check the messages above.
echo.
set PGPASSWORD=
pause
exit /b 1
