# WhatsApp Integration - Quick Reference

## 🚀 What Was Implemented

### Core Features
✅ **Webhook Handler** - Receives delivery status updates from Meta
✅ **Signature Verification** - HMAC SHA-256 validation for security
✅ **Input Sanitization** - Prevents XSS and injection attacks
✅ **Retry Logic** - 3 attempts with exponential backoff (5s, 15s, 60s)
✅ **SMS Fallback** - Framework for SMS when WhatsApp fails
✅ **Admin Tools** - Endpoints to view and resend failed messages

## 📁 Files Modified/Created

### Modified
- `server/src/services/whatsapp.service.ts` - Added sanitization, retry, signature verification
- `server/src/services/auth.service.ts` - Pass OTP ID for retry tracking
- `server/src/services/notification.service.ts` - Pass notification ID for retry
- `server/src/routes/whatsapp.routes.ts` - Refactored to use controller
- `server/src/index.ts` - Added raw body parsing for webhook
- `server/.env.example` - Added WHATSAPP_APP_SECRET, SMS_PROVIDER

### Created
- `server/src/controllers/whatsapp.controller.ts` - Webhook handlers
- `server/src/__tests__/whatsapp.test.ts` - Test suite
- `server/WHATSAPP_HARDENING.md` - Technical documentation
- `server/WHATSAPP_IMPLEMENTATION.md` - Implementation summary
- `server/WHATSAPP_DEPLOYMENT_CHECKLIST.md` - Deployment guide
- `server/test-whatsapp-webhook.sh` - Unix test script
- `server/test-whatsapp-webhook.bat` - Windows test script

## 🔧 Environment Variables

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_APP_SECRET=your_app_secret      # NEW - For signature verification
SMS_PROVIDER=twilio                       # NEW - Optional SMS fallback
```

## 🌐 API Endpoints

### Public Endpoints
```
GET  /api/whatsapp/webhook              # Webhook verification
POST /api/whatsapp/webhook              # Status updates from Meta
```

### Admin Endpoints (Requires Auth)
```
GET  /api/whatsapp/admin/failed         # List failed notifications
POST /api/whatsapp/admin/resend         # Resend failed messages
```

## 🧪 Testing Commands

### Run Tests
```bash
cd server
npm test -- whatsapp.test.ts
```

### Test Webhook (Windows)
```bash
test-whatsapp-webhook.bat delivered
```

### Test Webhook (Unix/Mac)
```bash
chmod +x test-whatsapp-webhook.sh
./test-whatsapp-webhook.sh delivered
```

### Manual Webhook Test
```bash
curl -X POST http://localhost:5001/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=SIGNATURE" \
  -d '{"object":"whatsapp_business_account","entry":[...]}'
```

## 📊 Database Queries

### Check Delivery Status
```sql
SELECT deliveryStatus, COUNT(*) 
FROM OTP 
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY deliveryStatus;
```

### Find Failed Notifications
```sql
SELECT * FROM RideNotification 
WHERE status = 'FAILED' 
ORDER BY sentAt DESC 
LIMIT 20;
```

### Monitor Retry Attempts
```sql
SELECT retries, COUNT(*) 
FROM RideNotification 
WHERE retries > 0 
GROUP BY retries;
```

## 🔒 Security Features

1. **Webhook Signature Verification** - Validates requests from Meta
2. **Input Sanitization** - Removes `<>\"'&`, limits to 1000 chars
3. **Rate Limiting** - Existing 10 msg/driver/hour for ride notifications
4. **Authentication** - Admin endpoints require JWT token

## 🔄 Retry Flow

```
Send WhatsApp Message
    ↓
  Fails?
    ↓
Enqueue for Retry
    ↓
Wait 5 seconds → Retry #1
    ↓
  Fails?
    ↓
Wait 15 seconds → Retry #2
    ↓
  Fails?
    ↓
Wait 60 seconds → Retry #3
    ↓
  Fails?
    ↓
Mark as FAILED → SMS Fallback (if configured)
```

## 📈 Status Flow

```
OTP/Notification Created
    ↓
deliveryStatus: PENDING
    ↓
WhatsApp API Called
    ↓
deliveryStatus: SENT (messageId stored)
    ↓
Webhook Received: "delivered"
    ↓
deliveryStatus: DELIVERED
    ↓
Webhook Received: "read"
    ↓
deliveryStatus: READ
```

## 🚨 Troubleshooting

### Webhook Not Working
1. Check `WHATSAPP_VERIFY_TOKEN` matches Meta config
2. Verify server is publicly accessible (HTTPS)
3. Check logs for signature validation errors
4. Test with Meta's webhook testing tool

### OTP Not Delivered
1. Verify template is approved in Meta Business Suite
2. Check phone format: E.164 (+1234567890)
3. Review `OTP.deliveryStatus` in database
4. Check WhatsApp API rate limits

### Signature Verification Failing
1. Verify `WHATSAPP_APP_SECRET` is correct
2. Check raw body is used (not parsed JSON)
3. Test signature generation locally

## 📚 Documentation

- **WHATSAPP_HARDENING.md** - Complete technical guide
- **WHATSAPP_IMPLEMENTATION.md** - Implementation details
- **WHATSAPP_DEPLOYMENT_CHECKLIST.md** - Deployment steps
- **whatsapp.test.ts** - Test examples

## 🎯 Success Metrics

- Delivery success rate: **> 95%**
- Webhook processing time: **< 100ms**
- Signature verification: **< 5ms**
- Retry success rate: **> 80%**

## 🔗 Useful Links

- [Meta Business Suite](https://business.facebook.com/)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhook Setup Guide](https://developers.facebook.com/docs/graph-api/webhooks)

## 📞 Support

For issues:
1. Check server logs: `pm2 logs itaxi-api`
2. Review database status queries above
3. Check Meta Business Suite for API status
4. Review WHATSAPP_HARDENING.md for detailed troubleshooting

---

**Version**: 1.0.0
**Status**: ✅ Production Ready
**Last Updated**: 2024-01-15
