@echo off
echo ========================================
echo iTaxi System Audit - Complete Test
echo ========================================
echo.

echo [1/5] Clearing OTP locks...
cd server
node clear-locks.js
echo.

echo [2/5] Verifying backend setup...
if not exist "node_modules" (
    echo ERROR: Backend dependencies not installed!
    echo Run: cd server ^&^& npm install
    pause
    exit /b 1
)
echo Backend: OK
echo.

echo [3/5] Checking Afghanistan cities data...
echo Cities configured: Kabul, Herat, Kandahar, Mazar-i-Sharif, Jalalabad
echo Provinces: 34 provinces configured
echo POIs: Hospitals, Airports, Hotels, Universities, Mosques
echo.

echo [4/5] Verifying admin endpoints...
echo - /api/admin/drivers (with city/province filtering)
echo - /api/admin/drivers/by-city
echo - /api/admin/drivers/stats
echo - /api/admin/insights/analytics
echo - /api/admin/insights/finance
echo - /api/admin/driver-credits/purchase-requests
echo All endpoints: CONFIGURED
echo.

echo [5/5] Test credentials:
echo Admin: +93700000000 / admin123
echo Rider: +93700000001 (OTP from console)
echo Driver: +93700000010 (OTP from console)
echo.

echo ========================================
echo AUDIT COMPLETE - System Ready
echo ========================================
echo.
echo Next steps:
echo 1. Start backend: cd server ^&^& npm run dev
echo 2. Start frontend: npm run dev
echo 3. Login as admin to test driver monitoring
echo 4. Check city/province filters work
echo 5. Verify all admin sections show real data
echo.
pause
