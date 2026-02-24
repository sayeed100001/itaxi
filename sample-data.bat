@echo off
title iTaxi - Sample Data Manager
color 0B

echo ========================================
echo   iTaxi Sample Data Manager
echo ========================================
echo.
echo 1. Add Sample Data (Riders + Drivers)
echo 2. Remove Sample Data
echo 3. Exit
echo.
set /p choice="Select option (1-3): "

if "%choice%"=="1" goto add
if "%choice%"=="2" goto remove
if "%choice%"=="3" goto end

:add
echo.
echo Adding sample data...
cd server
call npm run prisma:seed
cd ..
echo.
echo ========================================
echo Sample Data Added!
echo ========================================
echo.
echo Login Credentials:
echo   Admin:  +93700000000 / admin123
echo   Rider:  +93700000001 (OTP: any 6 digits)
echo   Driver: +93700000010 (OTP: any 6 digits)
echo.
echo 4 Online Drivers in Kabul area
echo ========================================
pause
goto end

:remove
echo.
echo Removing sample data...
cd server
call npm run prisma:cleanup
cd ..
echo.
echo Sample data removed!
pause
goto end

:end
