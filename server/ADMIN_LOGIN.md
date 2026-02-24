# ورود ادمین (Admin Login)

## علت خطای 500 فعلی

پیام **"Authentication failed against database server, the provided database credentials for root are not valid"** یعنی اتصال به MySQL با کاربری که در `DATABASE_URL` گذاشته‌اید برقرار نمی‌شود.

- در فایل **`server/.env`** مقدار **`DATABASE_URL`** را با نام کاربر و **رمز عبور درست** MySQL تنظیم کنید.
- فرمت:  
  `DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/itaxi"`  
  مثال (اگر رمز root شما `mypass` است):  
  `DATABASE_URL="mysql://root:mypass@localhost:3306/itaxi"`  
- اگر رمز root را نمی‌دانید، از MySQL یا XAMPP/WAMP آن را تنظیم یا ریست کنید و همان را در `.env` بگذارید.

## بعد از درست شدن اتصال دیتابیس

1. **مایگریشن و سید:**
   ```bash
   cd server
   npx prisma migrate deploy
   npx prisma db seed
   ```

2. **ورود ادمین با کاربر پیش‌فرض سید:**
   - **ایمیل:** `admin1@itaxi.com`
   - **رمز:** `admin123`

   یا:
   - **ایمیل:** `admin2@itaxi.com`
   - **رمز:** `admin123`

3. در پورتال ادمین (صفحه لاگین ادمین) همین ایمیل و رمز را وارد کنید.

## اگر هنوز لاگین نشد

- در لاگ سرور (`server`) خطای جدید را ببینید.
- مطمئن شوید یک بار `npx prisma db seed` را اجرا کرده‌اید تا کاربر ادمین با ایمیل و رمز بالا ساخته شود.
