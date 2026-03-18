@echo off
echo Starting iTaxi Development Environment...
echo.

if not exist .env (
  echo .env not found - creating from .env.example ...
  copy .env.example .env >nul
  echo Please edit .env with your MySQL credentials if needed.
  echo.
)

echo Cleaning up existing processes (ports 5000 and 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
echo.

echo Initializing database...
call npm run init-db
echo.

echo Starting server (port 5000) and client (port 5173)...
call npm run dev
echo.

echo Development environment ready!
echo Frontend: http://localhost:5173
echo API:      http://localhost:5000
pause
