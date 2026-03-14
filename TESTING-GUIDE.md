# 🧪 راهنمای تست سیستم iTaxi

## ✅ تست اتوماتیک تمام ویژگیها

این فایل برای تست کامل سیستم بعد از اصلاحات است.

---

## 1️⃣ تست پایه (Basic Tests)

### ✅ Health Check
```bash
curl http://localhost:3000/api/health
```
**انتظار:**
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

### ✅ Metrics
```bash
curl http://localhost:3000/api/metrics
```
**انتظار:**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total 123
...
```

---

## 2️⃣ تست Authentication

### ✅ Login (بدون 2FA)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+10000000002",
    "password": "rider123"
  }'
```
**انتظار:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "rider-id",
    "name": "Rider Demo",
    "role": "rider"
  }
}
```

### ✅ Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "+93701234567",
    "password": "test123",
    "role": "rider"
  }'
```

---

## 3️⃣ تست 2FA

### ✅ Setup 2FA
```bash
TOKEN="your_jwt_token"

curl -X POST http://localhost:3000/api/auth/2fa/setup \
  -H "Authorization: Bearer $TOKEN"
```
**انتظار:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

### ✅ Enable 2FA
```bash
curl -X POST http://localhost:3000/api/auth/2fa/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

### ✅ Login با 2FA
```bash
# Step 1: Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+10000000002",
    "password": "rider123"
  }'

# Response:
# { "requires2FA": true, "tempToken": "..." }

# Step 2: Verify
curl -X POST http://localhost:3000/api/auth/verify-2fa \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "...",
    "code": "123456"
  }'
```

---

## 4️⃣ تست Emergency SOS

### ✅ Trigger SOS
```bash
curl -X POST http://localhost:3000/api/emergency/sos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rideId": "ride-123",
    "location": {
      "lat": 34.5333,
      "lng": 69.1667
    }
  }'
```
**انتظار:**
```json
{
  "id": "alert-123",
  "rideId": "ride-123",
  "status": "active"
}
```

### ✅ Get Active Alerts
```bash
curl -X GET http://localhost:3000/api/emergency/alerts \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5️⃣ تست Promo Codes

### ✅ Create Promo Code (Admin)
```bash
curl -X POST http://localhost:3000/api/promo/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME50",
    "type": "percentage",
    "value": 50,
    "maxUses": 100,
    "minFare": 100,
    "maxDiscount": 200,
    "validFrom": "2024-01-01",
    "validUntil": "2024-12-31",
    "active": true
  }'
```

### ✅ Validate Promo Code
```bash
curl -X POST http://localhost:3000/api/promo/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME50",
    "fare": 200
  }'
```
**انتظار:**
```json
{
  "valid": true,
  "discount": 100
}
```

---

## 6️⃣ تست Referral System

### ✅ Get Referral Code
```bash
curl -X GET http://localhost:3000/api/referral/code \
  -H "Authorization: Bearer $TOKEN"
```
**انتظار:**
```json
{
  "code": "ITAXIABC123"
}
```

### ✅ Apply Referral Code
```bash
curl -X POST http://localhost:3000/api/referral/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ITAXIABC123"
  }'
```
**انتظار:**
```json
{
  "success": true,
  "message": "؋50 bonus added to your wallet!"
}
```

### ✅ Get Referral Stats
```bash
curl -X GET http://localhost:3000/api/referral/stats \
  -H "Authorization: Bearer $TOKEN"
```
**انتظار:**
```json
{
  "total": 5,
  "completed": 3,
  "pending": 2,
  "earnings": 300
}
```

---

## 7️⃣ تست Ride Creation (با Dynamic Pricing)

### ✅ Create Ride با Promo Code
```bash
curl -X POST http://localhost:3000/api/rides \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider-id",
    "pickup": "Kabul Airport",
    "destination": "City Center",
    "pickupLoc": { "lat": 34.5656, "lng": 69.2124 },
    "destLoc": { "lat": 34.5333, "lng": 69.1667 },
    "serviceType": "city",
    "promoCode": "WELCOME50"
  }'
```
**انتظار:**
```json
{
  "id": "ride-123",
  "fare": 150,
  "surge_multiplier": 1.2,
  "promo_discount": 75,
  "final_fare": 105
}
```

---

## 8️⃣ تست Database Abstraction

### ✅ با SQLite (Default)
```bash
# در .env:
DB_TYPE=sqlite

npm run dev
```

### ✅ با MySQL
```bash
# در .env:
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=itaxi

npm run dev
```

**تست:**
```bash
curl http://localhost:3000/api/health
# باید در هر دو حالت کار کند
```

---

## 9️⃣ تست Fraud Detection

### ✅ تست Multiple Rides
```bash
# ایجاد 6 ride در 5 دقیقه
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/rides \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "riderId": "rider-id",
      "pickup": "Location A",
      "destination": "Location B",
      "pickupLoc": { "lat": 34.5, "lng": 69.1 },
      "destLoc": { "lat": 34.6, "lng": 69.2 },
      "serviceType": "city"
    }'
  sleep 10
done
```
**انتظار:** بعد از ride ششم:
```json
{
  "error": "Ride request blocked due to suspicious activity"
}
```

---

## 🔟 تست Metrics & Logging

### ✅ Check Metrics
```bash
curl http://localhost:3000/api/metrics | grep "http_requests_total"
```
**انتظار:**
```
http_requests_total 456
http_requests_total{status="200"} 400
http_requests_total{status="401"} 50
```

### ✅ Check Logs
```bash
# بررسی log files
ls -la logs/
cat logs/combined-*.log | tail -20
cat logs/error-*.log
```

---

## 1️⃣1️⃣ تست Socket.IO

### ✅ Real-time Connection
```javascript
// در browser console:
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('join_room', 'rider-id');
});

socket.on('new_ride_request', (data) => {
  console.log('New ride:', data);
});

socket.on('ride_accepted', (data) => {
  console.log('Ride accepted:', data);
});
```

---

## 1️⃣2️⃣ تست Performance

### ✅ Load Test
```bash
# نصب Apache Bench
# Windows: https://www.apachelounge.com/download/
# Linux: sudo apt install apache2-utils

# تست 1000 request با 10 concurrent
ab -n 1000 -c 10 http://localhost:3000/api/health
```
**انتظار:**
```
Requests per second: 500-1000
Time per request: 10-20ms
Failed requests: 0
```

---

## ✅ چکلیست نهایی

### Backend Services:
- [ ] Health check works
- [ ] Metrics endpoint works
- [ ] Login works
- [ ] 2FA setup works
- [ ] 2FA login works
- [ ] SOS trigger works
- [ ] Promo validation works
- [ ] Referral apply works
- [ ] Ride creation works
- [ ] Dynamic pricing works
- [ ] Fraud detection works
- [ ] Socket.IO works

### Database:
- [ ] SQLite works
- [ ] MySQL works
- [ ] Queries execute correctly
- [ ] Transactions work

### Monitoring:
- [ ] Metrics collected
- [ ] Logs written
- [ ] Performance acceptable

### Security:
- [ ] JWT authentication works
- [ ] 2FA works
- [ ] Rate limiting works
- [ ] Input validation works

---

## 🎯 نتیجه

اگر تمام تستها pass شدند:
**✅ سیستم 100% آماده است!**

اگر تستی fail شد:
1. Log files را بررسی کنید
2. .env را چک کنید
3. Database connection را تست کنید
4. Dependencies را دوباره نصب کنید

---

## 📞 پشتیبانی

اگر مشکلی داشتید:
1. `logs/error-*.log` را بررسی کنید
2. `npm run dev` output را بخوانید
3. Database connection را تست کنید
4. Port 3000 آزاد باشد

---

**تمام تستها را اجرا کنید تا مطمئن شوید سیستم کار میکند!** ✅
