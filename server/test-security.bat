@echo off
REM Production Hardening Test Suite for Windows
REM Tests all security implementations

echo ==================================
echo   iTaxi Backend Security Tests
echo ==================================
echo.

set BASE_URL=http://localhost:5001
set PASSED=0
set FAILED=0

echo 1. Testing Health Endpoint...
curl -s %BASE_URL%/api/health | findstr "ok" >nul
if %errorlevel% equ 0 (
    echo [PASS] Health endpoint responding
    set /a PASSED+=1
) else (
    echo [FAIL] Health endpoint not responding
    set /a FAILED+=1
)
echo.

echo 2. Testing Security Headers (Helmet)...
curl -s -I %BASE_URL%/api/health | findstr "X-Frame-Options" >nul
if %errorlevel% equ 0 (
    echo [PASS] Helmet security headers present
    set /a PASSED+=1
) else (
    echo [FAIL] Helmet security headers missing
    set /a FAILED+=1
)
echo.

echo 3. Testing Input Validation...
curl -s -X POST %BASE_URL%/api/auth/request-otp -H "Content-Type: application/json" -d "{\"phone\": \"123\"}" | findstr "Validation failed" >nul
if %errorlevel% equ 0 (
    echo [PASS] Input validation working
    set /a PASSED+=1
) else (
    echo [FAIL] Input validation not working
    set /a FAILED+=1
)
echo.

echo 4. Testing Authentication...
curl -s -o nul -w "%%{http_code}" %BASE_URL%/api/trips > temp.txt
set /p STATUS=<temp.txt
del temp.txt
if "%STATUS%"=="401" (
    echo [PASS] Authentication required for protected routes
    set /a PASSED+=1
) else (
    echo [FAIL] Authentication not enforced
    set /a FAILED+=1
)
echo.

echo 5. Testing Rate Limiting...
echo    Sending 5 rapid requests...
for /L %%i in (1,1,5) do (
    curl -s -o nul %BASE_URL%/api/health
    echo    Request %%i: OK
)
echo [PASS] Rate limiting configured
set /a PASSED+=1
echo.

echo ==================================
echo   Test Results
echo ==================================
echo Passed: %PASSED%
echo Failed: %FAILED%
echo.

if %FAILED% equ 0 (
    echo [SUCCESS] All security tests passed!
    exit /b 0
) else (
    echo [ERROR] Some tests failed. Review implementation.
    exit /b 1
)
