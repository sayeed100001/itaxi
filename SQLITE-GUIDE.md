# iTaxi - راهنمای نصب سریع با SQLite

## 🚀 نصب و اجرا (فقط 2 دستور!)

### مرحله 1: نصب
```bash
cd "d:\1111web apps\itaxi final\ITAXI-main"
npm install
```

### مرحله 2: اجرا
```bash
npm run dev
```

این دستور خودکار:
- ✅ دیتابیس SQLite را ایجاد میکند
- ✅ جداول را میسازد
- ✅ دیتای تست را وارد میکند
- ✅ سرور را اجرا میکند

---

## 🌐 دسترسی

باز کنید:
```
http://localhost:3000
```

---

## 👥 حسابهای تست

### مسافر (Rider)
```
Phone: +10000000002
Password: rider123
```

### راننده (Driver)
```
Phone: +10000000001
Password: driver123
```

### ادمین (Admin)
```
Phone: +10000000000
Password: admin123
```

---

## 📁 فایل دیتابیس

دیتابیس در این مسیر ذخیره میشود:
```
d:\1111web apps\itaxi final\ITAXI-main\itaxi.db
```

برای پاک کردن و شروع مجدد:
```bash
del itaxi.db
npm run dev
```

---

## ✅ مزایای SQLite

- ✅ نیاز به نصب PostgreSQL ندارد
- ✅ فقط یک فایل است
- ✅ سریع و سبک
- ✅ مناسب برای تست و توسعه
- ✅ قابل انتقال به هر جا

---

## 🔄 تبدیل به MySQL (بعداً)

وقتی آماده production شدید:
1. MySQL نصب کنید
2. فایل `server.ts` را برای MySQL تغییر دهید
3. دیتا را Export/Import کنید

---

**همین! سیستم آماده است! 🎉**
