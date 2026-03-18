# iTaxi - راهنمای نصب و راه‌اندازی کامل

## ✅ تغییرات نهایی اعمال شده

### 1. سیستم امتیاز و تخفیف (Loyalty System)
- ✅ هر سفر = 1 امتیاز
- ✅ 10+ سفر = Silver (5% تخفیف)
- ✅ 30+ سفر = Gold (10% تخفیف)  
- ✅ 50+ سفر = Platinum (15% تخفیف)
- ✅ نمایش در WalletPage

### 2. سیستم رتبه‌دهی دو طرفه
- ✅ API: `/api/rides/:id/rate`
- ✅ محاسبه خودکار میانگین
- ✅ Modal رتبه‌دهی بعد از سفر

### 3. جستجوی آدرس
- ✅ API: `/api/search` با Nominatim
- ✅ UI جستجو در RiderHome
- ✅ نمایش نتایج روی نقشه

### 4. پیشنهاد قیمت توسط مسافر
- ✅ فیلد ورودی قیمت
- ✅ ذخیره در `proposed_fare`
- ✅ راننده قبول/رد

### 5. دکمه واتساپ
- ✅ باز شدن چت واتساپ
- ✅ پیام خودکار

### 6. حذف پرداخت از مسافر
- ✅ فقط نمایش امتیاز
- ✅ راننده: درخواست کریدت

### 7. کمیسیون 20%
- ✅ تنظیم در server و schema

### 8. رزرو زمان‌بندی شده
- ✅ ذخیره `scheduled_time`
- ✅ ارسال به راننده در زمان مناسب

---

## 📦 نصب و راه‌اندازی

### پیش‌نیازها
```bash
Node.js 18+
MySQL 8+
```

### مرحله 1: نصب Dependencies
```bash
npm install
```

### مرحله 2: تنظیم دیتابیس
```bash
# اطمینان از اجرای MySQL (بدون Docker)
# سپس ساخت دیتابیس/جداول/Seed به صورت خودکار:
npm run init-db
```

اختیاری (برای تست سریع با حساب‌های آماده):

```bash
# PowerShell (Windows)
$env:SEED_DEMO_DATA='1'
npm run init-db
```

نکته: بعد از فعال شدن KYC، راننده تا زمانی که KYC او توسط ادمین تایید نشود نمی‌تواند آنلاین شود و درخواست سفر دریافت کند.

### مرحله 3: تنظیم .env
```bash
cp .env.example .env
```

ویرایش `.env`:
```env
JWT_SECRET=your_super_secret_key_here
PORT=5000

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=itaxi

# اختیاری
REDIS_URL=redis://localhost:6379
ORS_API_KEY=your_openrouteservice_key
```

### PostgreSQL (Neon / Vercel Postgres) - Production
اگر می‌خواهی محیط Production به‌جای MySQL از Neon/Vercel Postgres استفاده کند:

```env
DB_PROVIDER=postgres
JWT_SECRET=your_super_secret_key_here
NODE_ENV=production

# اگر از Vercel Postgres/Neon integration استفاده می‌کنی معمولاً POSTGRES_URL موجود است
POSTGRES_URL=postgresql://user:pass@host:5432/db?sslmode=require

# یا از DATABASE_URL استفاده کن
# DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

Backend (Railway/Render/VM):
```bash
npm run init-db
npm start
```

Vercel (frontend):
- `VITE_API_URL` اختیاری است؛ اگر ست کردی می‌تواند `https://backend.example.com` یا `.../api` باشد.
- اگر خالی بگذاری، فرانت‌اند از same-origin `/api` استفاده می‌کند و `vercel.json` آن را rewrite می‌کند.

### مرحله 4: اجرا
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

---

## 📱 تست در موبایل

### 1. پیدا کردن IP کامپیوتر
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
```

### 2. دسترسی از موبایل
```
# Development (Vite)
http://YOUR_IP:5173

# Production (server serves dist)
http://YOUR_IP:5000
```

### 3. حساب‌های تست
```
این حساب‌ها فقط زمانی تضمین می‌شوند که `SEED_DEMO_DATA=1` باشد (یا دیتابیس کاملاً خالی باشد).

Admin:
Phone: +10000000000
Password: admin123

Driver:
Phone: +10000000001
Password: driver123

Rider:
Phone: +10000000002
Password: rider123
```

---

## 🔄 فلوی کامل سیستم

### مسافر (Rider):
1. ورود به سیستم
2. جستجوی مقصد یا انتخاب روی نقشه
3. مشاهده قیمت‌های پیشنهادی
4. پیشنهاد قیمت دلخواه
5. درخواست سفر (فوری یا رزرو)
6. ردیابی راننده روی نقشه
7. چت/واتساپ با راننده
8. رتبه‌دهی بعد از سفر
9. دریافت امتیاز و تخفیف خودکار

### راننده (Driver):
1. ورود و فعال‌سازی
2. درخواست کریدت از ادمین
3. دریافت درخواست سفر
4. قبول/رد درخواست
5. ردیابی مسیر به مسافر
6. شروع سفر
7. چت/واتساپ با مسافر
8. تکمیل سفر
9. دریافت 80% کرایه (20% کمیسیون)
10. رتبه‌دهی به مسافر

### ادمین (Admin):
1. مشاهده تمام رانندهها روی نقشه
2. تایید/رد درخواست‌های کریدت
3. مشاهده آمار و گزارشات
4. تنظیمات داینامیک:
   - قیمت‌گذاری
   - کمیسیون
   - سرویس‌ها
   - نقشه و مسیریابی

---

## 🗄️ ساختار دیتابیس

### جداول اصلی:
- `users` - کاربران (مسافر، راننده، ادمین)
- `drivers` - اطلاعات رانندگان
- `rides` - سفرها
- `transactions` - تراکنش‌های مالی
- `credit_requests` - درخواست‌های کریدت
- `withdrawal_requests` - درخواست‌های برداشت
- `chat_messages` - پیام‌ها
- `admin_settings` - تنظیمات سیستم

### فیلدهای مهم:
```sql
users:
  - loyalty_points (امتیاز)
  - discount_percent (درصد تخفیف)
  - rating (میانگین رتبه)
  - balance (موجودی)

rides:
  - proposed_fare (قیمت پیشنهادی)
  - scheduled_time (زمان رزرو)
  - rider_rating (رتبه مسافر)
  - driver_rating (رتبه راننده)
```

---

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - ورود
- `POST /api/auth/register` - ثبت‌نام

### Rides
- `POST /api/rides` - ایجاد سفر
- `GET /api/rides/user/:userId` - سفرهای کاربر
- `PUT /api/rides/:id/status` - تغییر وضعیت
- `POST /api/rides/:id/rate` - رتبه‌دهی

### Wallet
- `GET /api/wallet/:userId` - اطلاعات کیف پول
- `POST /api/wallet/credit-request` - درخواست کریدت

### Search
- `GET /api/search?q=...` - جستجوی آدرس

### Admin
- `GET /api/admin/stats` - آمار
- `GET /api/admin/financials` - مالی
- `POST /api/admin/financials/approve` - تایید درخواست

---

## ✨ ویژگی‌های کلیدی

### 1. Real-time با Socket.IO
- ردیابی لحظه‌ای راننده
- اعلان درخواست سفر
- چت آنی

### 2. Geospatial با H3
- جستجوی سریع رانندگان نزدیک
- بهینه‌سازی dispatch

### 3. Responsive Design
- Safe Area برای Notch
- Touch Optimized
- Mobile First

### 4. Security
- JWT Authentication
- bcrypt Password Hashing
- Rate Limiting
- Helmet Security Headers

---

## 🚀 Production Deployment

### 1. Build
```bash
npm run build
```

### 2. Environment Variables
```env
NODE_ENV=production
JWT_SECRET=strong_random_secret
REDIS_URL=your_redis_url

MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=itaxi
```

### 3. Process Manager
```bash
# با PM2
pm2 start npm --name "itaxi" -- start
pm2 save
pm2 startup
```

### 4. Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📊 مانیتورینگ

### Logs
```bash
# Server logs
pm2 logs itaxi

# Database logs
# MySQL log path depends on OS/distro; check your MySQL server config.
```

### Health Check
```bash
curl http://localhost:5000/api/health
```

---

## 🐛 عیب‌یابی

### مشکل: دیتابیس متصل نمی‌شود
```bash
# بررسی وضعیت MySQL
sudo systemctl status mysql

# بررسی تنظیمات MySQL در .env
echo $MYSQL_HOST
echo $MYSQL_DATABASE
```

### مشکل: Socket.IO کار نمی‌کند
- بررسی CORS settings
- بررسی Firewall
- بررسی Redis connection (اگر استفاده می‌شود)

### مشکل: نقشه نمایش داده نمی‌شود
- بررسی Leaflet CSS import
- بررسی Network در DevTools
- بررسی Console errors

---

## 📞 پشتیبانی

برای مشکلات و سوالات:
1. بررسی Console Errors
2. بررسی Network Tab
3. بررسی Server Logs
4. بررسی Database Logs

---

## ✅ Checklist نهایی

- [ ] MySQL نصب و راه‌اندازی شده
- [ ] `npm run init-db` اجرا شده
- [ ] .env تنظیم شده
- [ ] Dependencies نصب شده
- [ ] Server اجرا می‌شود
- [ ] Login کار می‌کند
- [ ] نقشه نمایش داده می‌شود
- [ ] درخواست سفر کار می‌کند
- [ ] Socket.IO متصل است
- [ ] رتبه‌دهی کار می‌کند
- [ ] سیستم امتیاز فعال است
- [ ] جستجوی آدرس کار می‌کند
- [ ] واتساپ باز می‌شود
- [ ] در موبایل تست شده

---

**همه چیز آماده است! 🎉**
