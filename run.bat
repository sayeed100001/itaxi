@echo off
title iTaxi - Starting System
color 0A

echo ========================================
echo   iTaxi Premium Ride-Hailing Platform
echo ========================================
echo.

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [1/4] Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Frontend dependencies installation failed!
        echo Make sure Node.js is installed: https://nodejs.org
        echo.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Frontend dependencies OK
)

if not exist "server\node_modules\" (
    echo [2/4] Installing backend dependencies...
    cd server
    call npm install
    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Backend dependencies installation failed!
        echo.
        cd ..
        pause
        exit /b 1
    )
    cd ..
) else (
    echo [2/4] Backend dependencies OK
)

:: Check if .env exists
if not exist "server\.env" (
    echo [3/4] Creating .env file...
    copy "server\.env.example" "server\.env" >nul 2>&1
    color 0E
    echo.
    echo WARNING: Using default .env configuration
    echo.
    echo IMPORTANT: Configure these in server\.env:
    echo   - DATABASE_URL (MySQL connection)
    echo   - JWT_SECRET (random secure string)
    echo   - STRIPE_SECRET_KEY (from Stripe dashboard)
    echo   - OPENROUTESERVICE_API_KEY (from openrouteservice.org)
    echo.
    echo System will start with defaults (some features may not work)
    echo.
    timeout /t 5 /nobreak >nul
    color 0A
) else (
    echo [3/4] Environment file OK
)

:: Generate Prisma Client and Seed Database
echo [4/5] Setting up database...
cd server
call npx prisma generate >nul 2>&1
if errorlevel 1 (
    echo WARNING: Prisma generation had issues (will retry on start)
)

:: Check if database has data, if not seed it
echo Checking for sample data...
call npm run prisma:seed >nul 2>&1
cd ..

:: Clear Vite cache
echo [5/5] Clearing cache...
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite" >nul 2>&1

echo.
echo ========================================
echo   Starting iTaxi System
echo ========================================
echo.

:: Kill any existing processes on ports 5000 and 3000
echo Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo Backend API: http://localhost:5000
echo Frontend UI: http://localhost:3000
echo.
echo Two windows will open:
echo   1. Backend Server (port 5000)
echo   2. Frontend App (port 3000)
echo.
echo Wait 15 seconds after both start, then open:
echo   http://localhost:3000
echo.
echo Press Ctrl+C in each window to stop
echo.

:: Start backend first
echo Starting backend server...
start "iTaxi Backend (Port 5000)" cmd /k "cd server && npm run dev"

:: Wait for backend to initialize
timeout /t 5 /nobreak >nul

:: Start frontend
echo Starting frontend app...
start "iTaxi Frontend (Port 3000)" cmd /k "npm run dev"

echo.
color 0B
echo ========================================
echo   System Starting...
echo ========================================
echo.
echo Wait 15 seconds for both services to start
echo Then open: http://localhost:3000
echo.
echo Default Login:
echo   Phone: +93700000001 (Rider)
echo   Phone: +93700000002 (Driver)
echo   Phone: +93700000000 (Admin, Password: admin123)
echo.
echo Press any key to exit this window...
pause >nul
