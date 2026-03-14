// مدیریت انواع تاکسی و آیکون های مربوطه

export interface TaxiType {
    id: string;
    name: string;
    nameFa: string;
    description: string;
    descriptionFa: string;
    imagePath: string;
    iconSize: [number, number];
    baseFare: number;
    perKmRate: number;
    features: string[];
    featuresFa: string[];
    color: string;
    minRating?: number;
    minRides?: number;
}

export const TAXI_TYPES: Record<string, TaxiType> = {
    eco: {
        id: 'eco',
        name: 'Economy',
        nameFa: 'اقتصادی',
        description: 'Affordable rides for everyday trips',
        descriptionFa: 'سفرهای مقرون به صرفه برای روزمره',
        imagePath: '/img/map-icons/eco.svg',
        iconSize: [40, 40],
        baseFare: 30000,
        perKmRate: 5000,
        features: ['Standard car', 'AC', 'Safe ride'],
        featuresFa: ['خودروی استاندارد', 'تهویه مطبوع', 'سفر امن'],
        color: '#10B981'
    },
    plus: {
        id: 'plus',
        name: 'Plus',
        nameFa: 'پلاس',
        description: 'More comfort with better vehicles',
        descriptionFa: 'راحتی بیشتر با خودروهای بهتر',
        imagePath: '/img/map-icons/plus.svg',
        iconSize: [45, 45],
        baseFare: 45000,
        perKmRate: 7000,
        features: ['Newer car', 'Premium AC', 'Phone charger'],
        featuresFa: ['خودروی جدیدتر', 'تهویه پریمیوم', 'شارژر موبایل'],
        color: '#3B82F6'
    },
    lux: {
        id: 'lux',
        name: 'Luxury',
        nameFa: 'لوکس',
        description: 'Premium vehicles for special occasions',
        descriptionFa: 'خودروهای پریمیوم برای مناسبات خاص',
        imagePath: '/img/map-icons/lux.svg',
        iconSize: [50, 50],
        baseFare: 70000,
        perKmRate: 10000,
        features: ['Luxury car', 'Leather seats', 'WiFi', 'Water'],
        featuresFa: ['خودروی لوکس', 'صندلی چرمی', 'وای فای', 'آب'],
        color: '#8B5CF6',
        minRating: 4.5
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        nameFa: 'پریمیوم',
        description: 'Top-tier service with experienced drivers',
        descriptionFa: 'سرویس درجه یک با رانندگان باتجربه',
        imagePath: '/img/map-icons/premium.svg',
        iconSize: [55, 55],
        baseFare: 100000,
        perKmRate: 15000,
        features: ['Premium car', 'VIP service', 'Refreshments', 'Priority support'],
        featuresFa: ['خودروی پریمیوم', 'سرویس VIP', 'نوشیدنی', 'پشتیبانی اولویت'],
        color: '#F59E0B',
        minRating: 4.8,
        minRides: 1000
    }
};

// تعیین نوع تاکسی بر اساس اطلاعات راننده
export const determineTaxiType = (driver: any, taxiTypes: Record<string, TaxiType> = TAXI_TYPES): TaxiType => {
    const resolve = (id: TaxiType['id']): TaxiType => {
        return (taxiTypes[id] as TaxiType) || TAXI_TYPES[id];
    };

    // اگر راننده نوع مشخصی دارد
    if (driver.type && taxiTypes[driver.type]) {
        return taxiTypes[driver.type];
    }

    // تعیین خودکار بر اساس رتبه و تعداد سفر
    const rating = driver.rating || 0;
    const totalRides = driver.totalRides || 0;

    if (rating >= 4.8 && totalRides >= 1000) {
        return resolve('premium');
    } else if (rating >= 4.5 && totalRides >= 500) {
        return resolve('lux');
    } else if (rating >= 4.0 && totalRides >= 100) {
        return resolve('plus');
    } else {
        return resolve('eco');
    }
};

// محاسبه کرایه بر اساس نوع تاکسی
export const calculateFare = (
    taxiType: TaxiType, 
    distance: number, // کیلومتر
    duration: number, // دقیقه
    surgeMultiplier: number = 1
): number => {
    const baseFare = taxiType.baseFare;
    const distanceFare = distance * taxiType.perKmRate;
    const timeFare = duration * 1000; // 1000 افغانی در دقیقه
    
    const totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier;
    
    return Math.round(totalFare);
};

// دریافت رنگ بر اساس وضعیت راننده
export const getDriverStatusColor = (status: string): string => {
    switch (status) {
        case 'available':
            return '#10B981'; // سبز
        case 'busy':
            return '#EF4444'; // قرمز
        case 'offline':
            return '#6B7280'; // خاکستری
        case 'suspended':
            return '#F59E0B'; // نارنجی
        default:
            return '#6B7280';
    }
};

// دریافت متن وضعیت به فارسی
export const getDriverStatusText = (status: string): string => {
    switch (status) {
        case 'available':
            return 'آنلاین';
        case 'busy':
            return 'مشغول';
        case 'offline':
            return 'آفلاین';
        case 'suspended':
            return 'تعلیق';
        default:
            return 'نامشخص';
    }
};
