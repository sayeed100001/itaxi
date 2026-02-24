@echo off
REM iTaxi System Validation Test
REM Tests all critical fixes applied

echo ========================================
echo iTaxi System Validation Test
echo ========================================
echo.

REM Test 1: Check if servers are running
echo [TEST 1] Checking if servers are running...
curl -s http://localhost:5000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Backend server not running on port 5000
    echo Please run: npm run dev in server directory
    exit /b 1
) else (
    echo [PASS] Backend server is running
)

curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Frontend server not running on port 3000
    echo Please run: npm run dev in root directory
    exit /b 1
) else (
    echo [PASS] Frontend server is running
)
echo.

REM Test 2: Check database connection
echo [TEST 2] Checking database connection...
cd server
call npx prisma db pull >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Database connection failed
    echo Please check DATABASE_URL in server/.env
    cd ..
    exit /b 1
) else (
    echo [PASS] Database connection successful
)
cd ..
echo.

REM Test 3: Test admin login endpoint
echo [TEST 3] Testing admin login endpoint...
curl -s -X POST http://localhost:5000/api/auth/admin/login ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"+93700000000\",\"password\":\"admin123\"}" > temp_response.json 2>&1

findstr /C:"success" temp_response.json >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Admin login failed
    echo Response:
    type temp_response.json
    del temp_response.json
    exit /b 1
) else (
    echo [PASS] Admin login successful
)
del temp_response.json
echo.

REM Test 4: Test OTP request endpoint
echo [TEST 4] Testing OTP request endpoint...
curl -s -X POST http://localhost:5000/api/auth/request-otp ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"+93700000001\"}" > temp_response.json 2>&1

findstr /C:"success" temp_response.json >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] OTP request failed
    echo Response:
    type temp_response.json
    del temp_response.json
    exit /b 1
) else (
    echo [PASS] OTP request successful
)
del temp_response.json
echo.

REM Test 5: Check if sample data exists
echo [TEST 5] Checking sample data...
cd server
call npx prisma db execute --stdin < nul 2>&1 | findstr /C:"User" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Sample data may not be seeded
    echo Run: npm run seed in server directory
) else (
    echo [PASS] Sample data exists
)
cd ..
echo.

REM Test 6: Validate critical files
echo [TEST 6] Validating critical files...
set FILES_OK=1

if not exist "App.tsx" (
    echo [FAIL] App.tsx not found
    set FILES_OK=0
)

if not exist "pages\Rider\RiderHome.tsx" (
    echo [FAIL] RiderHome.tsx not found
    set FILES_OK=0
)

if not exist "pages\Landing\LandingPage.tsx" (
    echo [FAIL] LandingPage.tsx not found
    set FILES_OK=0
)

if not exist "server\src\routes\trip.routes.ts" (
    echo [FAIL] trip.routes.ts not found
    set FILES_OK=0
)

if not exist "server\src\middlewares\auth.ts" (
    echo [FAIL] auth.ts not found
    set FILES_OK=0
)

if %FILES_OK%==1 (
    echo [PASS] All critical files present
) else (
    echo [FAIL] Some critical files missing
    exit /b 1
)
echo.

REM Test 7: Check for admin trip authorization
echo [TEST 7] Checking admin trip authorization...
findstr /C:"authorize('RIDER', 'ADMIN')" server\src\routes\trip.routes.ts >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Admin trip authorization not found in trip.routes.ts
    echo Admin cannot request rides!
    exit /b 1
) else (
    echo [PASS] Admin trip authorization configured
)
echo.

REM Test 8: Check landing page logic
echo [TEST 8] Checking landing page logic...
findstr /C:"return <LandingPage" App.tsx >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Landing page return logic not found in App.tsx
    exit /b 1
) else (
    echo [PASS] Landing page logic present
)
echo.

echo ========================================
echo All Tests Passed!
echo ========================================
echo.
echo System Status: OPERATIONAL
echo.
echo Next Steps:
echo 1. Open http://localhost:3000 in incognito mode
echo 2. Verify landing page shows
echo 3. Login as admin: +93700000000 / admin123
echo 4. Try requesting a taxi
echo 5. Verify no 403 errors
echo.
echo Sample Credentials:
echo   Admin: +93700000000 / admin123
echo   Rider: +93700000001 (OTP: any 6 digits)
echo   Driver: +93700000010 (OTP: any 6 digits)
echo.
pause
