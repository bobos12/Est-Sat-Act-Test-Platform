@echo off
REM 16hundred - start the local development server
cd /d "%~dp0"
echo Checking packages...
call npm install --no-audit --no-fund
echo.
echo 16hundred is starting at http://localhost:3000
echo Keep this window open while testing. Close it to stop the server.
echo.
call npm run dev
pause
