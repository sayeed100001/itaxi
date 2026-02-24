# WhatsApp Cloud API Integration Guide

## Overview
iTaxi uses WhatsApp Cloud API for:
1. OTP delivery for authentication
2. Ride request notifications to drivers
3. Direct chat between riders and drivers during active trips

## Setup Steps

### 1. Create Meta Business Account
1. Go to https://business.facebook.com
2. Create a Business Account
3. Navigate to Meta Business Suite

### 2. Set Up WhatsApp Business API
1. Go to https://developers.facebook.com
2. Create a new App
3. Add "WhatsApp" product to your app
4. Complete Business Verification

### 3. Get Credentials
From WhatsApp Business API Dashboard:
- **Phone Number ID**: Found in API Setup > Phone Numbers
- **Access Token**: Generate from API Setup > Temporary Access Token (or create permanent token)
- **Verify Token**: Create your own random string for webhook verification

### 4. Create Message Templates
1. Go to WhatsApp Manager > Message Templates
2. Create OTP template:
   - **Name**: `otp_template`
   - **Category**: Authentication
   - **Language**: English (US)
   - **Body**: 
     ```
     Your iTaxi verification code is {{1}}. Valid for 5 minutes. Do not share this code.
     ```
3. Submit for approval (usually approved within minutes)

**Note:** Ride notifications use text messages (no template required)

### 5. Configure Environment Variables
Add to your `.env` file:
```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_VERIFY_TOKEN=your_verify_token_here
```

### 6. Run Database Migration
```bash
cd server
# If database is running:
npx prisma migrate dev --name add_whatsapp_delivery_tracking

# Or manually run the SQL:
mysql -u username -p itaxi < prisma/migrations/add_whatsapp_delivery_tracking.sql
```

### 7. Test OTP Delivery
1. Start the server: `npm run dev`
2. Request OTP via API:
   ```bash
   curl -X POST http://localhost:5001/api/auth/request-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+1234567890", "name": "Test User"}'
   ```
3. Check WhatsApp on the phone number
4. Verify OTP:
   ```bash
   curl -X POST http://localhost:5001/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+1234567890", "code": "123456"}'
   ```

## Phone Number Format
WhatsApp requires international format without + symbol:
- ✅ Correct: `1234567890` (country code + number)
- ❌ Wrong: `+1234567890` or `234567890`

## Features Implemented

### 1. OTP Generation
- 6-digit random code
- Hashed with bcrypt before storage
- 5-minute expiration

### 2. WhatsApp OTP Delivery
- Sends via Meta Graph API
- Uses approved template message
- Tracks delivery status in database

### 3. Ride Request Notifications
- Sent to top 3 nearest drivers
- Includes pickup address, distance, fare
- Deep link for quick acceptance: `itaxi://driver/accept?tripId=...`
- Rate limited: 10 messages per driver per hour
- Logged in `RideNotification` table

### 3. Direct Chat Feature
- "Chat via WhatsApp" button appears during active trips
- Only enabled when trip status is ACCEPTED or ARRIVED
- Opens WhatsApp with pre-filled message containing Ride ID
- Confirmation modal before opening external app
- Rider sees driver's WhatsApp number
- Driver sees rider's phone number

### 4. Delivery Logging
- `deliveryStatus`: PENDING → SENT/FAILED
- `messageId`: WhatsApp message ID for tracking
- Winston logging for all operations

### 5. Error Handling
- Graceful fallback if WhatsApp fails
- Detailed error logging
- Database status updates

## Monitoring

Check OTP delivery status:
```sql
SELECT phone, deliveryStatus, messageId, createdAt 
FROM OTP 
WHERE createdAt > NOW() - INTERVAL 1 HOUR
ORDER BY createdAt DESC;
```

Check ride notifications:
```sql
SELECT rn.tripId, rn.driverId, rn.status, rn.messageId, rn.sentAt,
       d.whatsappNumber, u.name as driverName
FROM RideNotification rn
JOIN Driver d ON rn.driverId = d.id
JOIN User u ON d.userId = u.id
WHERE rn.sentAt > NOW() - INTERVAL 1 HOUR
ORDER BY rn.sentAt DESC;
```

Check driver notification rate limits:
```sql
SELECT driverId, COUNT(*) as notifications_sent
FROM RideNotification
WHERE sentAt > NOW() - INTERVAL 1 HOUR
GROUP BY driverId
HAVING notifications_sent >= 10;
```

Check logs:
```bash
tail -f logs/combined.log | grep "WhatsApp"
```

## Cost Estimation
- **Free Tier**: 1,000 conversations/month
- **Paid**: $0.005 - $0.09 per conversation (varies by country)
- **Authentication messages**: Usually free or lowest tier

## Troubleshooting

### Error: "WhatsApp service not configured"
- Check `.env` file has all three variables
- Restart server after adding variables

### Error: "Template not found"
- Ensure template name is exactly `otp_template`
- Check template is approved in WhatsApp Manager

### Error: "Invalid phone number"
- Use international format without +
- Include country code

### OTP not received
- Check phone number is registered with WhatsApp
- Verify template is approved
- Check server logs for delivery errors
- Verify access token is valid

## Production Checklist
- [ ] Business verification completed
- [ ] Template approved
- [ ] Permanent access token generated
- [ ] Phone number verified
- [ ] Webhook configured (optional)
- [ ] Rate limiting enabled
- [ ] Monitoring set up
- [ ] Backup SMS provider configured (optional)

## Security Notes
- OTPs are hashed with bcrypt before storage
- Access tokens stored in environment variables
- Delivery status tracked for audit
- 5-minute expiration enforced
- Failed attempts logged

## Next Steps
1. Set up webhook for delivery status updates
2. Implement rate limiting on OTP endpoint (3 requests/hour per phone)
3. Add backup SMS provider (Twilio) for fallback
4. Monitor delivery rates and costs
