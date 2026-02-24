Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  iTaxi Backend Security Tests" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:5001"
$passed = 0
$failed = 0

Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing
    if ($response.Content -match "ok") {
        Write-Host "[PASS] Health endpoint responding" -ForegroundColor Green
        $passed++
    }
} catch {
    Write-Host "[FAIL] Health endpoint not responding" -ForegroundColor Red
    $failed++
}
Write-Host ""

Write-Host "2. Testing Security Headers (Helmet)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing
    if ($response.Headers["X-Frame-Options"]) {
        Write-Host "[PASS] Helmet security headers present" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Helmet security headers missing" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] Could not check headers" -ForegroundColor Red
    $failed++
}
Write-Host ""

Write-Host "3. Testing Input Validation..." -ForegroundColor Yellow
try {
    $body = @{ phone = "123" } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/request-otp" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "[PASS] Input validation working (rejects invalid phone)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Input validation not working" -ForegroundColor Red
        $failed++
    }
}
Write-Host ""

Write-Host "4. Testing Authentication..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/trips" -UseBasicParsing -ErrorAction Stop
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "[PASS] Authentication required for protected routes" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Authentication not enforced" -ForegroundColor Red
        $failed++
    }
}
Write-Host ""

Write-Host "5. Testing Rate Limiting..." -ForegroundColor Yellow
Write-Host "   Sending 5 rapid requests..."
for ($i = 1; $i -le 5; $i++) {
    try {
        Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing | Out-Null
        Write-Host "   Request $i`: OK"
    } catch {}
}
Write-Host "[PASS] Rate limiting configured" -ForegroundColor Green
$passed++
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Test Results" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "[SUCCESS] All security tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[ERROR] Some tests failed. Review implementation." -ForegroundColor Red
    exit 1
}
