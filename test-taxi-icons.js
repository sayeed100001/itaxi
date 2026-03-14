// تست سیستم آیکون های نقشه iTaxi

import { TAXI_TYPES, determineTaxiType, calculateFare, getDriverStatusColor, getDriverStatusText } from '../services/taxiTypes';

// تست داده های نمونه راننده
const testDrivers = [
    {
        id: 'driver1',
        name: 'احمد رضایی',
        vehicle: 'تویوتا کرولا',
        rating: 4.2,
        totalRides: 50,
        type: 'eco',
        status: 'available',
        location: { lat: 34.5553, lng: 69.2075, bearing: 45 }
    },
    {
        id: 'driver2', 
        name: 'محمد احمدی',
        vehicle: 'هوندا سیویک',
        rating: 4.6,
        totalRides: 250,
        type: 'plus',
        status: 'busy',
        location: { lat: 34.5563, lng: 69.2085, bearing: 90 }
    },
    {
        id: 'driver3',
        name: 'علی حسینی', 
        vehicle: 'تویوتا کمری',
        rating: 4.7,
        totalRides: 600,
        type: 'lux',
        status: 'available',
        location: { lat: 34.5543, lng: 69.2065, bearing: 180 }
    },
    {
        id: 'driver4',
        name: 'حسن کریمی',
        vehicle: 'مرسدس بنز',
        rating: 4.9,
        totalRides: 1200,
        type: 'premium',
        status: 'available', 
        location: { lat: 34.5573, lng: 69.2095, bearing: 270 }
    },
    {
        id: 'driver5',
        name: 'رضا محمدی',
        vehicle: 'نیسان سنترا',
        rating: 4.8,
        totalRides: 1500,
        // بدون type مشخص - باید خودکار تشخیص داده شود
        status: 'offline',
        location: { lat: 34.5533, lng: 69.2055, bearing: 315 }
    }
];

// تست تعیین نوع تاکسی
console.log('🚗 تست تعیین نوع تاکسی:');
testDrivers.forEach(driver => {
    const taxiType = determineTaxiType(driver);
    console.log(`${driver.name}: ${taxiType.nameFa} (${taxiType.id}) - رتبه: ${driver.rating}, سفرها: ${driver.totalRides}`);
});

// تست محاسبه کرایه
console.log('\n💰 تست محاسبه کرایه:');
const testDistance = 5; // کیلومتر
const testDuration = 15; // دقیقه

Object.values(TAXI_TYPES).forEach(taxiType => {
    const normalFare = calculateFare(taxiType, testDistance, testDuration, 1);
    const surgeFare = calculateFare(taxiType, testDistance, testDuration, 1.5);
    
    console.log(`${taxiType.nameFa}:`);
    console.log(`  - کرایه عادی: ${normalFare.toLocaleString()} افغانی`);
    console.log(`  - کرایه با افزایش تقاضا (1.5x): ${surgeFare.toLocaleString()} افغانی`);
});

// تست رنگ و متن وضعیت
console.log('\n🎨 تست وضعیت رانندگان:');
const statuses = ['available', 'busy', 'offline', 'suspended'];
statuses.forEach(status => {
    const color = getDriverStatusColor(status);
    const text = getDriverStatusText(status);
    console.log(`${status}: ${text} (${color})`);
});

// تست ویژگی های تاکسی
console.log('\n✨ ویژگی های انواع تاکسی:');
Object.values(TAXI_TYPES).forEach(taxiType => {
    console.log(`${taxiType.nameFa}:`);
    console.log(`  - تصویر: ${taxiType.imagePath}`);
    console.log(`  - اندازه آیکون: ${taxiType.iconSize[0]}x${taxiType.iconSize[1]}`);
    console.log(`  - کرایه پایه: ${taxiType.baseFare.toLocaleString()} افغانی`);
    console.log(`  - هر کیلومتر: ${taxiType.perKmRate.toLocaleString()} افغانی`);
    console.log(`  - ویژگی ها: ${taxiType.featuresFa.join(', ')}`);
    console.log(`  - رنگ: ${taxiType.color}`);
    if (taxiType.minRating) console.log(`  - حداقل رتبه: ${taxiType.minRating}`);
    if (taxiType.minRides) console.log(`  - حداقل سفر: ${taxiType.minRides}`);
    console.log('');
});

// تست تشخیص خودکار نوع تاکسی
console.log('🤖 تست تشخیص خودکار نوع تاکسی:');
const autoDetectTests = [
    { rating: 3.8, totalRides: 20, expected: 'eco' },
    { rating: 4.2, totalRides: 150, expected: 'plus' },
    { rating: 4.6, totalRides: 600, expected: 'lux' },
    { rating: 4.9, totalRides: 1500, expected: 'premium' },
    { rating: 4.8, totalRides: 50, expected: 'plus' }, // رتبه بالا اما سفر کم
];

autoDetectTests.forEach((test, index) => {
    const mockDriver = { rating: test.rating, totalRides: test.totalRides };
    const detected = determineTaxiType(mockDriver);
    const isCorrect = detected.id === test.expected;
    
    console.log(`تست ${index + 1}: رتبه ${test.rating}, سفرها ${test.totalRides}`);
    console.log(`  انتظار: ${test.expected}, تشخیص: ${detected.id} ${isCorrect ? '✅' : '❌'}`);
});

export { testDrivers };