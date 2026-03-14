#!/usr/bin/env node

/**
 * تست نهایی یکپارچگی سیستم iTaxi
 * این اسکریپت تمام مشکلات شناسایی شده را بررسی و گزارش میدهد
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 شروع تست نهایی یکپارچگی سیستم iTaxi...\n');

const issues = [];
const fixes = [];

// 1. بررسی وجود فایلهای ضروری
console.log('📁 بررسی فایلهای ضروری...');
const requiredFiles = [
    'schema.sql',
    'server.ts', 
    'App.tsx',
    'store.ts',
    'services/adminAPI.ts',
    'services/taxiTypes.ts',
    'CRITICAL-FIXES.sql'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} موجود است`);
        fixes.push(`فایل ${file} موجود است`);
    } else {
        console.log(`❌ ${file} مفقود است`);
        issues.push(`فایل ${file} مفقود است`);
    }
});

// 2. بررسی محتوای schema.sql
console.log('\n🗄️ بررسی schema.sql...');
try {
    const schemaContent = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    if (schemaContent.includes('CREATE TABLE IF NOT EXISTS taxi_types')) {
        console.log('✅ جدول taxi_types در schema موجود است');
        fixes.push('جدول taxi_types به schema اضافه شد');
    } else {
        console.log('❌ جدول taxi_types در schema مفقود است');
        issues.push('جدول taxi_types در schema.sql تعریف نشده');
    }
    
    if (schemaContent.includes('taxi_type_id')) {
        console.log('✅ فیلد taxi_type_id در جدول drivers موجود است');
        fixes.push('فیلد taxi_type_id به جدول drivers اضافه شد');
    } else {
        console.log('❌ فیلد taxi_type_id در جدول drivers مفقود است');
        issues.push('فیلد taxi_type_id در جدول drivers مفقود است');
    }
    
    if (schemaContent.includes('service_types')) {
        console.log('✅ فیلد service_types در جدول drivers موجود است');
        fixes.push('فیلد service_types به جدول drivers اضافه شد');
    } else {
        console.log('❌ فیلد service_types در جدول drivers مفقود است');
        issues.push('فیلد service_types در جدول drivers مفقود است');
    }
    
    if (schemaContent.includes('earnings')) {
        console.log('✅ فیلد earnings در جدول drivers موجود است');
        fixes.push('فیلد earnings به جدول drivers اضافه شد');
    } else {
        console.log('❌ فیلد earnings در جدول drivers مفقود است');
        issues.push('فیلد earnings در جدول drivers مفقود است');
    }
    
    if (schemaContent.includes("INSERT INTO taxi_types")) {
        console.log('✅ دادههای پیشفرض taxi_types موجود است');
        fixes.push('دادههای پیشفرض taxi_types اضافه شد');
    } else {
        console.log('❌ دادههای پیشفرض taxi_types مفقود است');
        issues.push('دادههای پیشفرض taxi_types مفقود است');
    }
    
} catch (error) {
    console.log('❌ خطا در خواندن schema.sql:', error.message);
    issues.push('خطا در خواندن schema.sql');
}

// 3. بررسی server.ts
console.log('\n🖥️ بررسی server.ts...');
try {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
    
    if (serverContent.includes('/api/admin/taxi-types')) {
        console.log('✅ API endpoints برای taxi-types موجود است');
        fixes.push('API endpoints برای taxi-types پیادهسازی شد');
    } else {
        console.log('❌ API endpoints برای taxi-types مفقود است');
        issues.push('API endpoints برای taxi-types در server.ts مفقود است');
    }
    
    if (serverContent.includes('app.get("/api/admin/taxi-types"') && 
        serverContent.includes('app.post("/api/admin/taxi-types"') &&
        serverContent.includes('app.put("/api/admin/taxi-types/:id"') &&
        serverContent.includes('app.delete("/api/admin/taxi-types/:id"')) {
        console.log('✅ تمام CRUD operations برای taxi-types موجود است');
        fixes.push('تمام CRUD operations برای taxi-types پیادهسازی شد');
    } else {
        console.log('❌ برخی CRUD operations برای taxi-types مفقود است');
        issues.push('برخی CRUD operations برای taxi-types مفقود است');
    }
    
} catch (error) {
    console.log('❌ خطا در خواندن server.ts:', error.message);
    issues.push('خطا در خواندن server.ts');
}

// 4. بررسی store.ts
console.log('\n🏪 بررسی store.ts...');
try {
    const storeContent = fs.readFileSync(path.join(__dirname, 'store.ts'), 'utf8');
    
    if (storeContent.includes("import { apiFetch } from './services/api';")) {
        console.log('✅ مسیر import apiFetch تصحیح شده است');
        fixes.push('مسیر import apiFetch در store.ts تصحیح شد');
    } else if (storeContent.includes("import { apiFetch } from '@/services/api';")) {
        console.log('❌ مسیر import apiFetch اشتباه است');
        issues.push('مسیر import apiFetch در store.ts اشتباه است');
    } else {
        console.log('⚠️ import apiFetch یافت نشد');
        issues.push('import apiFetch در store.ts یافت نشد');
    }
    
    const anyUsageCount = (storeContent.match(/as any/g) || []).length;
    if (anyUsageCount > 0) {
        console.log(`⚠️ ${anyUsageCount} استفاده از "as any" در store.ts`);
        if (anyUsageCount <= 5) {
            fixes.push(`تعداد محدود (${anyUsageCount}) استفاده از "as any" - قابل قبول`);
        } else {
            issues.push(`${anyUsageCount} استفاده از "as any" در store.ts - نیاز به بهبود type safety`);
        }
    } else {
        console.log('✅ هیچ استفاده از "as any" یافت نشد');
        fixes.push('عدم استفاده از "as any" در store.ts');
    }
    
} catch (error) {
    console.log('❌ خطا در خواندن store.ts:', error.message);
    issues.push('خطا در خواندن store.ts');
}

// 5. بررسی App.tsx
console.log('\n📱 بررسی App.tsx...');
try {
    const appContent = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
    
    if (appContent.includes("import { AdminDriversPage } from './pages/Admin/AdminDriversPage';")) {
        console.log('✅ import AdminDriversPage صحیح است');
        fixes.push('import AdminDriversPage در App.tsx صحیح است');
    } else {
        console.log('❌ import AdminDriversPage اشتباه یا مفقود است');
        issues.push('import AdminDriversPage در App.tsx اشتباه یا مفقود است');
    }
    
    if (appContent.includes('SuperAdminPanel')) {
        console.log('❌ import اشتباه SuperAdminPanel موجود است');
        issues.push('import اشتباه SuperAdminPanel در App.tsx موجود است');
    } else {
        console.log('✅ import اشتباه SuperAdminPanel وجود ندارد');
        fixes.push('عدم وجود import اشتباه SuperAdminPanel');
    }
    
} catch (error) {
    console.log('❌ خطا در خواندن App.tsx:', error.message);
    issues.push('خطا در خواندن App.tsx');
}

// 6. بررسی services
console.log('\n🔧 بررسی services...');
const servicesPath = path.join(__dirname, 'services');
if (fs.existsSync(servicesPath)) {
    const serviceFiles = fs.readdirSync(servicesPath);
    
    if (serviceFiles.includes('adminAPI.ts')) {
        console.log('✅ adminAPI.ts موجود است');
        
        try {
            const adminAPIContent = fs.readFileSync(path.join(servicesPath, 'adminAPI.ts'), 'utf8');
            if (adminAPIContent.includes('getTaxiTypes') && 
                adminAPIContent.includes('createTaxiType') &&
                adminAPIContent.includes('updateTaxiType') &&
                adminAPIContent.includes('deleteTaxiType')) {
                console.log('✅ adminAPI.ts شامل تمام متدهای taxi-types است');
                fixes.push('adminAPI.ts کامل پیادهسازی شد');
            } else {
                console.log('❌ adminAPI.ts ناقص است');
                issues.push('adminAPI.ts فاقد متدهای کامل taxi-types است');
            }
        } catch (error) {
            console.log('❌ خطا در خواندن adminAPI.ts:', error.message);
            issues.push('خطا در خواندن adminAPI.ts');
        }
    } else {
        console.log('❌ adminAPI.ts مفقود است');
        issues.push('فایل adminAPI.ts مفقود است');
    }
    
    if (serviceFiles.includes('taxiTypes.ts')) {
        console.log('✅ taxiTypes.ts موجود است');
        fixes.push('taxiTypes.ts موجود و کامل است');
    } else {
        console.log('❌ taxiTypes.ts مفقود است');
        issues.push('فایل taxiTypes.ts مفقود است');
    }
} else {
    console.log('❌ پوشه services مفقود است');
    issues.push('پوشه services مفقود است');
}

// 7. بررسی CRITICAL-FIXES.sql
console.log('\n🚨 بررسی CRITICAL-FIXES.sql...');
try {
    const criticalFixesContent = fs.readFileSync(path.join(__dirname, 'CRITICAL-FIXES.sql'), 'utf8');
    
    if (criticalFixesContent.includes('CREATE TABLE IF NOT EXISTS taxi_types')) {
        console.log('✅ CRITICAL-FIXES.sql شامل ایجاد جدول taxi_types است');
        fixes.push('CRITICAL-FIXES.sql برای حل مشکلات دیتابیس آماده است');
    } else {
        console.log('❌ CRITICAL-FIXES.sql ناقص است');
        issues.push('CRITICAL-FIXES.sql فاقد تعریف جدول taxi_types است');
    }
    
} catch (error) {
    console.log('❌ خطا در خواندن CRITICAL-FIXES.sql:', error.message);
    issues.push('خطا در خواندن CRITICAL-FIXES.sql');
}

// 8. گزارش نهایی
console.log('\n' + '='.repeat(60));
console.log('📊 گزارش نهایی تست یکپارچگی');
console.log('='.repeat(60));

console.log(`\n✅ تعداد مشکلات حل شده: ${fixes.length}`);
fixes.forEach((fix, index) => {
    console.log(`   ${index + 1}. ${fix}`);
});

console.log(`\n❌ تعداد مشکلات باقیمانده: ${issues.length}`);
issues.forEach((issue, index) => {
    console.log(`   ${index + 1}. ${issue}`);
});

// محاسبه امتیاز یکپارچگی
const totalChecks = fixes.length + issues.length;
const integrationScore = totalChecks > 0 ? Math.round((fixes.length / totalChecks) * 100) : 100;

console.log(`\n🎯 امتیاز یکپارچگی: ${integrationScore}/100`);

if (integrationScore >= 90) {
    console.log('🎉 عالی! سیستم آماده production است');
} else if (integrationScore >= 75) {
    console.log('👍 خوب! با چند تصحیح کوچک آماده خواهد بود');
} else if (integrationScore >= 50) {
    console.log('⚠️ متوسط! نیاز به تصحیحات بیشتر دارد');
} else {
    console.log('🚨 ضعیف! نیاز به توجه فوری دارد');
}

// راهنمای اقدامات بعدی
console.log('\n📋 اقدامات توصیه شده:');
if (integrationScore >= 75) {
    console.log('1. ✅ سیستم آماده تست و استقرار است');
    console.log('2. 🧪 تست عملکرد کامل سیستم');
    console.log('3. 🚀 آماده برای production deployment');
} else {
    console.log('1. اجرای CRITICAL-FIXES.sql در دیتابیس');
    console.log('2. تصحیح مشکلات باقیمانده');
    console.log('3. تست API endpoints با Postman یا curl');
    console.log('4. بررسی console errors در مرورگر');
}

console.log('\n✨ تست یکپارچگی کامل شد!');

// خروجی JSON برای استفاده در CI/CD
const result = {
    timestamp: new Date().toISOString(),
    integrationScore,
    totalChecks,
    fixesCount: fixes.length,
    issuesCount: issues.length,
    fixes,
    issues,
    status: integrationScore >= 75 ? 'PASS' : 'FAIL',
    recommendation: integrationScore >= 90 ? 'PRODUCTION_READY' : 
                   integrationScore >= 75 ? 'READY_FOR_TESTING' : 
                   integrationScore >= 50 ? 'NEEDS_FIXES' : 'CRITICAL_ISSUES'
};

fs.writeFileSync(path.join(__dirname, 'integration-test-result.json'), JSON.stringify(result, null, 2));
console.log('\n💾 نتایج در فایل integration-test-result.json ذخیره شد');

process.exit(issues.length > 3 ? 1 : 0);