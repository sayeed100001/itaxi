# OTP Hardening - Quick Reference

## 🎯 What Changed

### Race Condition Fix
- **Before**: Delete → Create (race condition possible)
- **After**: Transaction(Delete → Create) + Unique constraint
- **Result**: Only 1 unverified OTP per phone guaranteed

### Rate Limiting
- **Limit**: 3 requests per hour per phone
- **Storage**: Redis (preferred) or Database
- **Config**: `OTP_MAX_PER_HOUR=3`

### Lockout
- **Trigger**: 5 failed verification attempts
- **Duration**: 60 minutes
- **Config**: `OTP_LOCK_THRESHOLD=5`, `OTP_LOCK_MINUTES=60`

### Cleanup
- **Schedule**: Every hour
- **Removes**: OTPs expired >24h, OTPRequests >24h

## 🔧 Configuration

```env
OTP_MAX_PER_HOUR=3
OTP_LOCK_THRESHOLD=5
OTP_LOCK_MINUTES=60
REDIS_URL=redis://localhost:6379  # Optional
```

## 🧪 Quick Tests

### Test Atomicity
```bash
# 5 concurrent requests → only 1 OTP created
for i in {1..5}; do
  curl -X POST http://localhost:5001/api/auth/request-otp \
    -d '{"phone": "+1234567890"}' &
done
```

### Test Rate Limit
```bash
# 4th request returns 429
for i in {1..4}; do
  curl -X POST http://localhost:5001/api/auth/request-otp \
    -d '{"phone": "+1234567890"}'
done
```

### Test Lockout
```bash
# 6th wrong attempt returns "Account locked"
for i in {1..6}; do
  curl -X POST http://localhost:5001/api/auth/verify-otp \
    -d '{"phone": "+1234567890", "code": "000000"}'
done
```

## 📊 Monitoring

```sql
-- Active locks
SELECT phone, failedAttempts, lockedUntil FROM OTPLock WHERE lockedUntil > NOW();

-- Rate limited phones
SELECT phone, count FROM OTPRequest WHERE count >= 3 AND windowStart >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Cleanup stats
SELECT COUNT(*) FROM OTP WHERE expiresAt < DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

## 📁 Key Files

- `server/src/services/auth.service.ts` - Atomic OTP logic
- `server/src/middlewares/otpRateLimiter.ts` - Rate limiting
- `server/src/services/otpCleanup.service.ts` - Cleanup cron
- `server/src/__tests__/otp-race.test.ts` - Tests

## 🗄️ Schema Changes

```prisma
model OTP {
  @@unique([phone, verified])  // NEW
}

model OTPRequest {  // NEW TABLE
  phone String
  windowStart DateTime
  count Int
  @@unique([phone, windowStart])
}

model OTPLock {
  failedAttempts Int  // Renamed from 'attempts'
}
```

## ✅ Status

All features production-ready and tested.

---

**Version**: 1.0.0
