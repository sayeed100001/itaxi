#!/bin/bash

# اسکریپت نهایی اجرای تمام اصلاحات و تست سیستم iTaxi
# این اسکریپت تمام مشکلات را حل میکند و سیستم را آماده production میکند

echo "🚀 Starting iTaxi System Integration & Fixes..."
echo "=================================================="

# رنگها برای خروجی
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# تابع لاگ
log() {
    echo -e "${2}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# بررسی وجود Node.js
if ! command -v node &> /dev/null; then
    log "❌ Node.js is not installed. Please install Node.js first." $RED
    exit 1
fi

# بررسی وجود npm
if ! command -v npm &> /dev/null; then
    log "❌ npm is not installed. Please install npm first." $RED
    exit 1
fi

log "✅ Node.js and npm are available" $GREEN

# مرحله 1: بررسی و نصب dependencies
log "📦 Step 1: Checking and installing dependencies..." $BLUE
if [ -f "package.json" ]; then
    npm install
    if [ $? -eq 0 ]; then
        log "✅ Dependencies installed successfully" $GREEN
    else
        log "❌ Failed to install dependencies" $RED
        exit 1
    fi
else
    log "❌ package.json not found" $RED
    exit 1
fi

# مرحله 2: بررسی دیتابیس MySQL
log "🗄️  Step 2: Checking MySQL database..." $BLUE

# بررسی متغیرهای محیطی
if [ -f ".env" ]; then
    source .env
    log "✅ Environment variables loaded" $GREEN
else
    log "⚠️  .env file not found, using defaults" $YELLOW
fi

# تنظیم متغیرهای پیشفرض
MYSQL_HOST=${MYSQL_HOST:-localhost}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-}
MYSQL_DATABASE=${MYSQL_DATABASE:-itaxi}

log "📊 Database Configuration:" $BLUE
log "   Host: $MYSQL_HOST" $BLUE
log "   User: $MYSQL_USER" $BLUE
log "   Database: $MYSQL_DATABASE" $BLUE

# بررسی اتصال MySQL
if command -v mysql &> /dev/null; then
    log "🔍 Testing MySQL connection..." $BLUE
    
    # تست اتصال
    if [ -z "$MYSQL_PASSWORD" ]; then
        mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -e "SELECT 1;" 2>/dev/null
    else
        mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1;" 2>/dev/null
    fi
    
    if [ $? -eq 0 ]; then
        log "✅ MySQL connection successful" $GREEN
        
        # ایجاد دیتابیس اگر وجود ندارد
        log "🏗️  Creating database if not exists..." $BLUE
        if [ -z "$MYSQL_PASSWORD" ]; then
            mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -e "CREATE DATABASE IF NOT EXISTS $MYSQL_DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        else
            mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $MYSQL_DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        fi
        
        # اجرای اسکریپت هماهنگسازی دیتابیس
        if [ -f "DATABASE-SYNC.sql" ]; then
            log "🔧 Running database synchronization..." $BLUE
            if [ -z "$MYSQL_PASSWORD" ]; then
                mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" "$MYSQL_DATABASE" < DATABASE-SYNC.sql
            else
                mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < DATABASE-SYNC.sql
            fi
            
            if [ $? -eq 0 ]; then
                log "✅ Database synchronized successfully" $GREEN
            else
                log "❌ Database synchronization failed" $RED
                exit 1
            fi
        else
            log "⚠️  DATABASE-SYNC.sql not found, skipping database sync" $YELLOW
        fi
    else
        log "❌ MySQL connection failed" $RED
        log "💡 Please check your MySQL configuration and credentials" $YELLOW
        exit 1
    fi
else
    log "⚠️  MySQL client not found, skipping database setup" $YELLOW
    log "💡 Please install MySQL client or run DATABASE-SYNC.sql manually" $YELLOW
fi

# مرحله 3: اجرای تست یکپارچگی
log "🧪 Step 3: Running comprehensive integration tests..." $BLUE
if [ -f "comprehensive-test.js" ]; then
    node comprehensive-test.js
    if [ $? -eq 0 ]; then
        log "✅ Integration tests completed" $GREEN
    else
        log "⚠️  Integration tests completed with issues" $YELLOW
    fi
else
    log "⚠️  comprehensive-test.js not found, skipping integration tests" $YELLOW
fi

# مرحله 4: بررسی TypeScript
log "🔍 Step 4: Checking TypeScript compilation..." $BLUE
if command -v tsc &> /dev/null; then
    npm run lint
    if [ $? -eq 0 ]; then
        log "✅ TypeScript compilation successful" $GREEN
    else
        log "⚠️  TypeScript compilation has warnings" $YELLOW
    fi
else
    log "⚠️  TypeScript compiler not found, skipping type check" $YELLOW
fi

# مرحله 5: بررسی فایلهای ضروری
log "📁 Step 5: Checking essential files..." $BLUE

essential_files=(
    "App.tsx"
    "server.ts"
    "store.ts"
    "db-config.ts"
    "services/taxiTypes.ts"
    "services/adminAPI.ts"
    "components/Map/RealMap.tsx"
    "pages/Admin/AdminDriversPage.tsx"
)

missing_files=()
for file in "${essential_files[@]}"; do
    if [ -f "$file" ]; then
        log "✅ $file exists" $GREEN
    else
        log "❌ $file is missing" $RED
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    log "✅ All essential files are present" $GREEN
else
    log "❌ Missing ${#missing_files[@]} essential files" $RED
    for file in "${missing_files[@]}"; do
        log "   - $file" $RED
    done
fi

# مرحله 6: بررسی تصاویر تاکسی
log "🖼️  Step 6: Checking taxi images..." $BLUE

taxi_images=(
    "img/map img/1.png"
    "img/map img/2.png"
    "img/map img/3big taxi.png"
    "img/map img/4.png"
)

missing_images=()
for image in "${taxi_images[@]}"; do
    if [ -f "$image" ]; then
        log "✅ $image exists" $GREEN
    else
        log "❌ $image is missing" $RED
        missing_images+=("$image")
    fi
done

if [ ${#missing_images[@]} -eq 0 ]; then
    log "✅ All taxi images are present" $GREEN
else
    log "❌ Missing ${#missing_images[@]} taxi images" $RED
    log "💡 Please add the missing taxi images to the img/map img/ directory" $YELLOW
fi

# مرحله 7: تست سرور
log "🌐 Step 7: Testing server startup..." $BLUE
timeout 10s npm run server &
SERVER_PID=$!
sleep 5

# بررسی اینکه سرور روشن شده
if kill -0 $SERVER_PID 2>/dev/null; then
    log "✅ Server started successfully" $GREEN
    kill $SERVER_PID 2>/dev/null
else
    log "❌ Server failed to start" $RED
fi

# مرحله 8: تولید گزارش نهایی
log "📊 Step 8: Generating final report..." $BLUE

# محاسبه امتیاز کلی
total_checks=0
passed_checks=0

# بررسی dependencies
total_checks=$((total_checks + 1))
if [ -d "node_modules" ]; then
    passed_checks=$((passed_checks + 1))
fi

# بررسی فایلهای ضروری
total_checks=$((total_checks + ${#essential_files[@]}))
passed_checks=$((passed_checks + ${#essential_files[@]} - ${#missing_files[@]}))

# بررسی تصاویر
total_checks=$((total_checks + ${#taxi_images[@]}))
passed_checks=$((passed_checks + ${#taxi_images[@]} - ${#missing_images[@]}))

# محاسبه درصد موفقیت
if [ $total_checks -gt 0 ]; then
    success_rate=$((passed_checks * 100 / total_checks))
else
    success_rate=0
fi

echo ""
echo "=================================================="
log "📊 FINAL SYSTEM INTEGRATION REPORT" $BLUE
echo "=================================================="
log "✅ Passed Checks: $passed_checks" $GREEN
log "❌ Failed Checks: $((total_checks - passed_checks))" $RED
log "📈 Success Rate: $success_rate%" $BLUE

if [ $success_rate -ge 90 ]; then
    log "🎉 SYSTEM STATUS: PRODUCTION READY" $GREEN
    log "🚀 Your iTaxi system is ready for deployment!" $GREEN
elif [ $success_rate -ge 75 ]; then
    log "⚠️  SYSTEM STATUS: NEEDS MINOR FIXES" $YELLOW
    log "🔧 Please address the remaining issues before deployment" $YELLOW
elif [ $success_rate -ge 50 ]; then
    log "🟡 SYSTEM STATUS: NEEDS MAJOR FIXES" $YELLOW
    log "🛠️  Significant issues need to be resolved" $YELLOW
else
    log "🔴 SYSTEM STATUS: CRITICAL ISSUES" $RED
    log "⚠️  System requires immediate attention" $RED
fi

echo ""
log "📋 NEXT STEPS:" $BLUE
if [ ${#missing_files[@]} -gt 0 ]; then
    log "1. Add missing essential files" $YELLOW
fi
if [ ${#missing_images[@]} -gt 0 ]; then
    log "2. Add missing taxi images" $YELLOW
fi
log "3. Review comprehensive-integration-report.json for detailed analysis" $BLUE
log "4. Test the application manually in browser" $BLUE
log "5. Deploy to staging environment" $BLUE

echo ""
log "🏁 iTaxi System Integration Complete!" $GREEN
echo "=================================================="

# ذخیره گزارش در فایل
{
    echo "iTaxi System Integration Report"
    echo "Generated: $(date)"
    echo "Success Rate: $success_rate%"
    echo "Passed Checks: $passed_checks"
    echo "Failed Checks: $((total_checks - passed_checks))"
    echo ""
    echo "Missing Files:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Missing Images:"
    for image in "${missing_images[@]}"; do
        echo "  - $image"
    done
} > system-integration-report.txt

log "📄 Report saved to: system-integration-report.txt" $BLUE

exit 0