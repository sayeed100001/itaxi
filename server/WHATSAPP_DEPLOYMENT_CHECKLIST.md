# WhatsApp Flow Hardening - Deployment Checklist

## Pre-Deployment

### 1. Environment Variables
- [ ] Set `WHATSAPP_PHONE_NUMBER_ID` from Meta Business Suite
- [ ] Set `WHATSAPP_ACCESS_TOKEN` from Meta Business Suite
- [ ] Set `WHATSAPP_VERIFY_TOKEN` (create random secure string)
- [ ] Set `WHATSAPP_APP_SECRET` from Meta App Dashboard
- [ ] (Optional) Set `SMS_PROVIDER` for fallback (e.g., "twilio")

### 2. Meta Business Suite Configuration
- [ ] Create WhatsApp Business Account
- [ ] Add phone number to account
- [ ] Generate access token (permanent or 60-day)
- [ ] Copy App Secret from App Dashboard
- [ ] Create and submit OTP template for approval
  - Template name: `otp_template`
  - Category: Authentication
  - Body: `Your iTaxi verification code is {{1}}. Valid for 5 minutes.`
- [ ] Wait for template approval (24-48 hours)

### 3. Webhook Setup
- [ ] Deploy application to production server
- [ ] Ensure server has public HTTPS URL
- [ ] In Meta Business Suite → Configuration → Webhooks:
  - [ ] Set Callback URL: `https://yourdomain.com/api/whatsapp/webhook`
  - [ ] Set Verify Token: Same as `WHATSAPP_VERIFY_TOKEN`
  - [ ] Subscribe to `messages` field
  - [ ] Click "Verify and Save"
- [ ] Verify webhook is receiving test events

### 4. Database Migration
- [ ] Run Prisma migrations (already done if using existing schema)
- [ ] Verify `OTP` table has `deliveryStatus` and `messageId` columns
- [ ] Verify `RideNotification` table exists with `status`, `messageId`, `retries`, `error` columns
- [ ] Verify `Driver` table has `whatsappNumber` column

### 5. Code Deployment
- [ ] Build TypeScript: `npm run build`
- [ ] Run tests: `npm test -- whatsapp.test.ts`
- [ ] Deploy to production server
- [ ] Restart application: `pm2 restart itaxi-api`

## Post-Deployment Testing

### 1. Webhook Verification
```bash
# Test GET verification
curl "https://yourdomain.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
# Expected: Returns "test123"
```

### 2. OTP Flow
- [ ] Request OTP via `/api/auth/request-otp`
- [ ] Check database: `SELECT * FROM OTP ORDER BY createdAt DESC LIMIT 1;`
- [ ] Verify `deliveryStatus` is "SENT" or "PENDING"
- [ ] Verify `messageId` is populated
- [ ] Check WhatsApp message received on phone
- [ ] Verify OTP code in message

### 3. Webhook Status Updates
- [ ] Send test webhook from Meta Business Suite
- [ ] Check server logs for "WhatsApp status update"
- [ ] Verify database updated: `SELECT deliveryStatus FROM OTP WHERE messageId = 'msg_xxx';`
- [ ] Test different statuses: sent, delivered, read, failed

### 4. Input Sanitization
```bash
# Test with dangerous input
curl -X POST https://yourdomain.com/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890<script>", "name": "Test"}'
# Verify no errors and input is sanitized
```

### 5. Retry Logic
- [ ] Temporarily set invalid `WHATSAPP_ACCESS_TOKEN`
- [ ] Request OTP
- [ ] Check logs for "Enqueued OTP for retry"
- [ ] Wait 5 seconds, check logs for retry attempt
- [ ] Restore valid token
- [ ] Verify OTP eventually sends

### 6. Admin Endpoints
```bash
# Get failed notifications
curl -X GET https://yourdomain.com/api/whatsapp/admin/failed \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Resend failed notification
curl -X POST https://yourdomain.com/api/whatsapp/admin/resend \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notificationIds": ["notif_xxx"]}'
```

## Monitoring Setup

### 1. Database Queries
Add to admin dashboard or monitoring tool:

```sql
-- Delivery success rate (last 24 hours)
SELECT 
  deliveryStatus,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM OTP
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY deliveryStatus;

-- Failed notifications
SELECT COUNT(*) as failed_count
FROM RideNotification
WHERE status = 'FAILED'
AND sentAt >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Retry statistics
SELECT 
  retries,
  COUNT(*) as count
FROM RideNotification
WHERE retries > 0
GROUP BY retries;
```

### 2. Alerts
Set up alerts for:
- [ ] Failure rate > 10%
- [ ] No OTPs sent in last 5 minutes (if traffic expected)
- [ ] Webhook signature validation failures
- [ ] Retry queue size > 100

### 3. Logging
- [ ] Verify logs contain "WhatsApp OTP sent"
- [ ] Verify logs contain "WhatsApp status update"
- [ ] Verify logs contain "Retry X/3 failed" for failures
- [ ] Check for any error logs

## Production Hardening

### 1. Rate Limiting
- [ ] Verify global rate limit: 100 req/15min
- [ ] Verify WhatsApp webhook rate limit (if added)
- [ ] Test rate limit enforcement

### 2. Security
- [ ] Verify HTTPS is enforced
- [ ] Verify webhook signature validation is working
- [ ] Verify input sanitization is applied
- [ ] Test with malicious payloads

### 3. Performance
- [ ] Monitor webhook response time (should be < 100ms)
- [ ] Monitor retry queue processing time
- [ ] Check memory usage (in-memory queue)
- [ ] Consider Redis for production scale

### 4. Backup Plan
- [ ] Document SMS fallback setup (if not implemented)
- [ ] Create runbook for WhatsApp API outages
- [ ] Document manual OTP delivery process
- [ ] Set up admin notification system

## Rollback Plan

If issues occur:

1. **Disable WhatsApp Integration**
   ```bash
   # Set empty credentials
   WHATSAPP_PHONE_NUMBER_ID=
   WHATSAPP_ACCESS_TOKEN=
   # Restart server
   pm2 restart itaxi-api
   ```

2. **Revert to Previous Version**
   ```bash
   git revert HEAD
   npm run build
   pm2 restart itaxi-api
   ```

3. **Emergency SMS Fallback**
   - Implement SMS provider immediately
   - Update `SMS_PROVIDER` env var
   - All OTPs will fallback to SMS

## Success Criteria

- [ ] OTP delivery success rate > 95%
- [ ] Webhook processing time < 100ms
- [ ] No signature validation errors
- [ ] Retry logic working correctly
- [ ] Admin endpoints accessible
- [ ] No security vulnerabilities
- [ ] Logs are clean and informative

## Documentation

- [ ] Update team wiki with WhatsApp setup
- [ ] Document troubleshooting steps
- [ ] Share admin endpoint usage
- [ ] Create incident response plan

## Sign-Off

- [ ] Backend Engineer: _______________
- [ ] DevOps Engineer: _______________
- [ ] QA Engineer: _______________
- [ ] Product Manager: _______________

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: 1.0.0

---

## Quick Reference

### Environment Variables
```env
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_VERIFY_TOKEN=random_secure_string
WHATSAPP_APP_SECRET=app_secret_from_meta
SMS_PROVIDER=twilio  # Optional
```

### Key Endpoints
- `GET /api/whatsapp/webhook` - Verification
- `POST /api/whatsapp/webhook` - Status updates
- `GET /api/whatsapp/admin/failed` - List failures
- `POST /api/whatsapp/admin/resend` - Retry failed

### Database Tables
- `OTP` - OTP records with delivery status
- `RideNotification` - Ride notification records
- `Driver` - Driver info with WhatsApp number

### Logs to Monitor
- "WhatsApp OTP sent"
- "WhatsApp status update"
- "Enqueued OTP for retry"
- "WhatsApp persistent failure"

---

**Status**: Ready for Production ✅
