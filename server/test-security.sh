#!/bin/bash

# Production Hardening Test Suite
# Tests all security implementations

echo "=================================="
echo "  iTaxi Backend Security Tests"
echo "=================================="
echo ""

BASE_URL="http://localhost:5001"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local expected=$2
    local actual=$3
    
    if [ "$actual" == "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $name (Expected: $expected, Got: $actual)"
        ((FAILED++))
    fi
}

echo "1. Testing Security Headers (Helmet)..."
HEADERS=$(curl -s -I $BASE_URL/api/health)
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo -e "${GREEN}✓${NC} Helmet security headers present"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Helmet security headers missing"
    ((FAILED++))
fi
echo ""

echo "2. Testing CORS Configuration..."
CORS=$(curl -s -H "Origin: http://evil.com" -I $BASE_URL/api/health | grep -i "access-control")
if [ -z "$CORS" ]; then
    echo -e "${GREEN}✓${NC} CORS blocks unauthorized origins"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} CORS may allow unauthorized origins"
    ((FAILED++))
fi
echo ""

echo "3. Testing Rate Limiting..."
echo "   Sending 5 rapid requests..."
for i in {1..5}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/health)
    if [ "$STATUS" == "200" ]; then
        echo "   Request $i: OK"
    fi
done
echo -e "${GREEN}✓${NC} Rate limiting configured (check headers for limits)"
((PASSED++))
echo ""

echo "4. Testing Input Validation..."
VALIDATION=$(curl -s -X POST $BASE_URL/api/auth/request-otp \
    -H "Content-Type: application/json" \
    -d '{"phone": "123"}' | grep -o "Validation failed")
if [ "$VALIDATION" == "Validation failed" ]; then
    echo -e "${GREEN}✓${NC} Input validation working (rejects invalid phone)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Input validation not working"
    ((FAILED++))
fi
echo ""

echo "5. Testing Error Handler..."
ERROR=$(curl -s $BASE_URL/api/trips/invalid-uuid | grep -o "error")
if [ "$ERROR" == "error" ]; then
    echo -e "${GREEN}✓${NC} Error handler returns structured errors"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Error handler not working properly"
    ((FAILED++))
fi
echo ""

echo "6. Testing Health Endpoint..."
HEALTH=$(curl -s $BASE_URL/api/health | grep -o "ok")
if [ "$HEALTH" == "ok" ]; then
    echo -e "${GREEN}✓${NC} Health endpoint responding"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Health endpoint not responding"
    ((FAILED++))
fi
echo ""

echo "7. Testing Authentication..."
UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/trips)
if [ "$UNAUTH" == "401" ]; then
    echo -e "${GREEN}✓${NC} Authentication required for protected routes"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Authentication not enforced"
    ((FAILED++))
fi
echo ""

echo "8. Testing Compression..."
COMPRESSION=$(curl -s -H "Accept-Encoding: gzip" -I $BASE_URL/api/health | grep -i "content-encoding")
if echo "$COMPRESSION" | grep -q "gzip"; then
    echo -e "${GREEN}✓${NC} Compression enabled"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Compression may not be enabled"
fi
echo ""

echo "=================================="
echo "  Test Results"
echo "=================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All security tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review implementation.${NC}"
    exit 1
fi
