# Railway (Backend) + Vercel (Frontend) Setup (MySQL)

این فایل برای این است که Backend روی Railway با دیتابیس MySQL بالا بیاید و Frontend روی Vercel به آن وصل شود.

## 1) Railway Variables (Backend Service)

داخل صفحه Variables همین سرویس (همان لینکی که فرستادی) این متغیرها را اضافه/اپدیت کن:

### ضروری
- `NODE_ENV=production`
- `DB_PROVIDER=mysql`
- `JWT_SECRET=<یک متن خیلی طولانی و رندوم (حداقل 32 کاراکتر)>`

### ساخت یوزرهای تست (فقط برای بار اول)
- `SEED_DEMO_DATA=1`
  - بعد از این که Deploy شد و لاگین تست کردی، این را حذف کن یا `0` کن (برای امنیت).

### تنظیمات دیتابیس MySQL
اگر از Railway MySQL Plugin استفاده می‌کنی معمولا خود Railway این متغیرها را اتومات می‌سازد:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`

کُد پروژه هم این نام‌ها را می‌خواند، پس لازم نیست حتما `MYSQL_HOST` و... بسازی.

اگر Plugin نداری یا دیتابیس بیرونی داری، این‌ها را به صورت دستی تنظیم کن:
- `MYSQL_HOST=<host>`
- `MYSQL_PORT=3306`
- `MYSQL_USER=<user>`
- `MYSQL_PASSWORD=<password>`
- `MYSQL_DATABASE=itaxi`

## 2) Railway Start Command

در Railway برای سرویس Backend، `Start Command` را `npm start` بگذار (یا اگر خالی است همان پیش‌فرض `npm start` استفاده می‌شود).
اسکریپت `start` اول دیتابیس را init می‌کند و بعد سرور را بالا می‌آورد.

## 3) تست سریع Backend بعد از Deploy

بعد از Deploy، این URL ها باید جواب بدهند (با دامنه Railway خودت):
- `https://<RAILWAY_DOMAIN>/api/health`
- `https://<RAILWAY_DOMAIN>/api/ready`

## 4) Vercel Environment Variables (Frontend)

در Vercel (Project Settings → Environment Variables) این‌ها را بگذار:
- `VITE_API_URL=https://<RAILWAY_DOMAIN>` (یا `VITE_API_BASE_URL`)
- `VITE_SOCKET_URL=https://<RAILWAY_DOMAIN>` (اختیاری: اگر نگذاری از `VITE_API_URL` استفاده می‌کند)

نکته:
- آخر URL اسلش نگذار.

## 5) یوزرهای تست (برای لاگین)

وقتی `SEED_DEMO_DATA=1` باشد (یا دیتابیس خالی باشد) این اکانت‌ها ساخته می‌شوند:
- Admin: `+10000000000` / `admin123`
- Driver: `+10000000001` / `driver123`
- Rider: `+10000000002` / `rider123`

بعد از تست، حتما پسوردها را تغییر بده و `SEED_DEMO_DATA` را خاموش کن.
