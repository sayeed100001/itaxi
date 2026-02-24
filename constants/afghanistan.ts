// Afghanistan Comprehensive Data
// All 34 provinces, major cities, and key Points of Interest (POIs)
// Used for rider destination search and map display

export interface Province {
    id: string;
    name: string;
    nameDari: string;
    capital: string;
    lat: number;
    lng: number;
    cities: City[];
}

export interface City {
    id: string;
    name: string;
    nameDari: string;
    province: string;
    lat: number;
    lng: number;
}

export interface POI {
    id: string;
    name: string;
    nameDari: string;
    type: 'hospital' | 'airport' | 'hotel' | 'mosque' | 'university' | 'market' | 'government' | 'landmark' | 'park' | 'bus_station';
    city: string;
    province: string;
    lat: number;
    lng: number;
    address?: string;
    phone?: string;
}

export const AFGHANISTAN_PROVINCES: Province[] = [
    { id: 'kabul', name: 'Kabul', nameDari: 'کابل', capital: 'Kabul', lat: 34.5260, lng: 69.1777, cities: [] },
    { id: 'herat', name: 'Herat', nameDari: 'هرات', capital: 'Herat', lat: 34.3529, lng: 62.2040, cities: [] },
    { id: 'kandahar', name: 'Kandahar', nameDari: 'کندهار', capital: 'Kandahar', lat: 31.6289, lng: 65.7372, cities: [] },
    { id: 'balkh', name: 'Balkh', nameDari: 'بلخ', capital: 'Mazar-i-Sharif', lat: 36.7069, lng: 67.1111, cities: [] },
    { id: 'nangarhar', name: 'Nangarhar', nameDari: 'ننگرهار', capital: 'Jalalabad', lat: 34.4415, lng: 70.4361, cities: [] },
    { id: 'ghor', name: 'Ghor', nameDari: 'غور', capital: 'Chaghcharan', lat: 34.5272, lng: 65.2568, cities: [] },
    { id: 'helmand', name: 'Helmand', nameDari: 'هلمند', capital: 'Lashkar Gah', lat: 31.5938, lng: 64.3558, cities: [] },
    { id: 'gahor', name: 'Ghazni', nameDari: 'غزنی', capital: 'Ghazni', lat: 33.5535, lng: 68.4152, cities: [] },
    { id: 'kunduz', name: 'Kunduz', nameDari: 'کندز', capital: 'Kunduz', lat: 36.7283, lng: 68.8572, cities: [] },
    { id: 'takhar', name: 'Takhar', nameDari: 'تخار', capital: 'Taloqan', lat: 36.7295, lng: 69.5133, cities: [] },
    { id: 'baghlan', name: 'Baghlan', nameDari: 'بغلان', capital: 'Pul-e-Khumri', lat: 35.9442, lng: 68.7139, cities: [] },
    { id: 'bamyan', name: 'Bamyan', nameDari: 'بامیان', capital: 'Bamyan', lat: 34.8217, lng: 67.8265, cities: [] },
    { id: 'badakhshan', name: 'Badakhshan', nameDari: 'بدخشان', capital: 'Fayzabad', lat: 37.1194, lng: 70.5792, cities: [] },
    { id: 'faryab', name: 'Faryab', nameDari: 'فاریاب', capital: 'Maymana', lat: 35.9221, lng: 64.7893, cities: [] },
    { id: 'jawzjan', name: 'Jawzjan', nameDari: 'جوزجان', capital: 'Sheberghan', lat: 36.6658, lng: 65.7521, cities: [] },
    { id: 'samangan', name: 'Samangan', nameDari: 'سمنگان', capital: 'Aybak', lat: 36.2658, lng: 68.0137, cities: [] },
    { id: 'sar-e-pol', name: 'Sar-e-Pol', nameDari: 'سرپل', capital: 'Sar-e-Pol', lat: 36.2149, lng: 65.9303, cities: [] },
    { id: 'badghis', name: 'Badghis', nameDari: 'بادغیس', capital: 'Qala i Naw', lat: 35.0039, lng: 63.1276, cities: [] },
    { id: 'farah', name: 'Farah', nameDari: 'فراه', capital: 'Farah', lat: 32.3739, lng: 62.1130, cities: [] },
    { id: 'nimroz', name: 'Nimroz', nameDari: 'نیمروز', capital: 'Zaranj', lat: 31.1124, lng: 61.8877, cities: [] },
    { id: 'hilmand', name: 'Hilmand', nameDari: 'هلمند', capital: 'Lashkar Gah', lat: 31.5938, lng: 64.3558, cities: [] },
    { id: 'uruzgan', name: 'Uruzgan', nameDari: 'ارزگان', capital: 'Tarin Kowt', lat: 32.6310, lng: 65.8748, cities: [] },
    { id: 'zabul', name: 'Zabul', nameDari: 'زابل', capital: 'Qalat', lat: 32.1053, lng: 66.9006, cities: [] },
    { id: 'paktika', name: 'Paktika', nameDari: 'پکتیکا', capital: 'Sharan', lat: 32.8471, lng: 68.5671, cities: [] },
    { id: 'paktia', name: 'Paktia', nameDari: 'پکتیا', capital: 'Gardez', lat: 33.5956, lng: 69.2257, cities: [] },
    { id: 'khost', name: 'Khost', nameDari: 'خوست', capital: 'Khost', lat: 33.3339, lng: 69.9200, cities: [] },
    { id: 'logar', name: 'Logar', nameDari: 'لوگر', capital: 'Pul-e-Alam', lat: 34.0042, lng: 69.1870, cities: [] },
    { id: 'wardak', name: 'Wardak', nameDari: 'وردک', capital: 'Maidan Shar', lat: 34.3957, lng: 68.8707, cities: [] },
    { id: 'kapisa', name: 'Kapisa', nameDari: 'کاپیسا', capital: 'Mahmud-i-Raqi', lat: 35.0163, lng: 69.3239, cities: [] },
    { id: 'parwan', name: 'Parwan', nameDari: 'پروان', capital: 'Charikar', lat: 35.0139, lng: 68.7557, cities: [] },
    { id: 'panjshir', name: 'Panjshir', nameDari: 'پنجشیر', capital: 'Bazarak', lat: 35.2289, lng: 69.6819, cities: [] },
    { id: 'laghman', name: 'Laghman', nameDari: 'لغمان', capital: 'Mihtarlam', lat: 34.6888, lng: 70.1884, cities: [] },
    { id: 'kunar', name: 'Kunar', nameDari: 'کنر', capital: 'Asadabad', lat: 34.8726, lng: 71.1474, cities: [] },
    { id: 'nuristan', name: 'Nuristan', nameDari: 'نورستان', capital: 'Parun', lat: 35.4297, lng: 70.9118, cities: [] },
];

export const AFGHANISTAN_CITIES: City[] = [
    // Kabul Province
    { id: 'kabul-city', name: 'Kabul', nameDari: 'کابل', province: 'kabul', lat: 34.5260, lng: 69.1777 },
    { id: 'kabul-microrayon', name: 'Microrayon', nameDari: 'مکروریان', province: 'kabul', lat: 34.5312, lng: 69.1945 },
    { id: 'kabul-karte-char', name: 'Karte Char', nameDari: 'کارته چهار', province: 'kabul', lat: 34.5020, lng: 69.1620 },
    { id: 'kabul-shahr-e-naw', name: 'Shar-e-Naw', nameDari: 'شهر نو', province: 'kabul', lat: 34.5280, lng: 69.1770 },
    { id: 'kabul-wazir', name: 'Wazir Akbar Khan', nameDari: 'وزیر اکبر خان', province: 'kabul', lat: 34.5370, lng: 69.1900 },
    // Herat
    { id: 'herat-city', name: 'Herat', nameDari: 'هرات', province: 'herat', lat: 34.3529, lng: 62.2040 },
    { id: 'herat-injil', name: 'Injil', nameDari: 'انجیل', province: 'herat', lat: 34.3100, lng: 62.1800 },
    { id: 'herat-guzara', name: 'Guzara', nameDari: 'گذره', province: 'herat', lat: 34.2900, lng: 62.1100 },
    // Kandahar
    { id: 'kandahar-city', name: 'Kandahar', nameDari: 'کندهار', province: 'kandahar', lat: 31.6289, lng: 65.7372 },
    { id: 'kandahar-spinboldak', name: 'Spin Boldak', nameDari: 'سپین بولدک', province: 'kandahar', lat: 31.0046, lng: 66.3956 },
    // Balkh / Mazar
    { id: 'mazar-city', name: 'Mazar-i-Sharif', nameDari: 'مزار شریف', province: 'balkh', lat: 36.7069, lng: 67.1111 },
    { id: 'balkh-city', name: 'Balkh', nameDari: 'بلخ', province: 'balkh', lat: 36.7563, lng: 66.8975 },
    { id: 'kishindeh', name: 'Kishindeh', nameDari: 'کشنده', province: 'balkh', lat: 36.5801, lng: 66.8954 },
    // Nangarhar / Jalalabad
    { id: 'jalalabad-city', name: 'Jalalabad', nameDari: 'جلال آباد', province: 'nangarhar', lat: 34.4415, lng: 70.4361 },
    { id: 'behsud', name: 'Behsud', nameDari: 'بهسود', province: 'nangarhar', lat: 34.4500, lng: 70.4600 },
    // Kunduz
    { id: 'kunduz-city', name: 'Kunduz', nameDari: 'کندز', province: 'kunduz', lat: 36.7283, lng: 68.8572 },
    // Takhar
    { id: 'taloqan-city', name: 'Taloqan', nameDari: 'تالقان', province: 'takhar', lat: 36.7295, lng: 69.5133 },
    // Ghazni
    { id: 'ghazni-city', name: 'Ghazni', nameDari: 'غزنی', province: 'gahor', lat: 33.5535, lng: 68.4152 },
    // Helmand / Lashkar Gah
    { id: 'laskhargah-city', name: 'Lashkar Gah', nameDari: 'لشکرگاه', province: 'helmand', lat: 31.5938, lng: 64.3558 },
    // Parwan
    { id: 'charikar-city', name: 'Charikar', nameDari: 'چاریکار', province: 'parwan', lat: 35.0139, lng: 68.7557 },
    // Bamyan
    { id: 'bamyan-city', name: 'Bamyan', nameDari: 'بامیان', province: 'bamyan', lat: 34.8217, lng: 67.8265 },
    // Khost
    { id: 'khost-city', name: 'Khost', nameDari: 'خوست', province: 'khost', lat: 33.3339, lng: 69.9200 },
    // Paktia
    { id: 'gardez-city', name: 'Gardez', nameDari: 'گردیز', province: 'paktia', lat: 33.5956, lng: 69.2257 },
    // Farah
    { id: 'farah-city', name: 'Farah', nameDari: 'فراه', province: 'farah', lat: 32.3739, lng: 62.1130 },
];

export const AFGHANISTAN_POIS: POI[] = [
    // ====== KABUL HOSPITALS ======
    { id: 'jamhuriat-hospital', name: 'Jamhuriat Hospital', nameDari: 'شفاخانه جمهوریت', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5200, lng: 69.1650, address: 'Mohammad Jan Khan Watt, Kabul' },
    { id: 'wazir-akbar-khan-hospital', name: 'Wazir Akbar Khan Hospital', nameDari: 'شفاخانه وزیر اکبر خان', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5380, lng: 69.1910, address: 'Wazir Akbar Khan, Kabul' },
    { id: 'indira-gandhi-hospital', name: 'Indira Gandhi Children Hospital', nameDari: 'شفاخانه اندرا گاندی', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5190, lng: 69.1560 },
    { id: 'ihn-sina-hospital', name: 'Ibn Sina Hospital', nameDari: 'شفاخانه ابن سینا', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5150, lng: 69.1600 },
    { id: 'rabia-balkhi-hospital', name: 'Rabia Balkhi Hospital', nameDari: 'شفاخانه رابعه بلخی', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5120, lng: 69.1700 },
    { id: 'ali-abad-hospital', name: 'Ali Abad Hospital', nameDari: 'شفاخانه علی آباد', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5060, lng: 69.1840 },
    { id: 'aster-clinic-kabul', name: 'Aster Medical Center', nameDari: 'مرکز طبی استر', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5350, lng: 69.1850 },
    { id: 'french-medical-institute', name: 'French Medical Institute for Mothers & Children', nameDari: 'انستیتوت طبی فرانسوی', type: 'hospital', city: 'Kabul', province: 'kabul', lat: 34.5273, lng: 69.1420 },
    // Herat Hospitals
    { id: 'herat-regional-hospital', name: 'Herat Regional Hospital', nameDari: 'شفاخانه منطقوی هرات', type: 'hospital', city: 'Herat', province: 'herat', lat: 34.3400, lng: 62.1990 },
    { id: 'malalai-herat', name: 'Malalai Maternity Hospital Herat', nameDari: 'شفاخانه ملالی هرات', type: 'hospital', city: 'Herat', province: 'herat', lat: 34.3450, lng: 62.2000 },
    // Kandahar Hospitals
    { id: 'mirwais-hospital', name: 'Mirwais Regional Hospital', nameDari: 'شفاخانه منطقوی میرویس', type: 'hospital', city: 'Kandahar', province: 'kandahar', lat: 31.6150, lng: 65.7250 },
    // Mazar Hospitals
    { id: 'mazar-razi-hospital', name: 'Mazar-i-Sharif Regional Hospital', nameDari: 'شفاخانه منطقوی مزار شریف', type: 'hospital', city: 'Mazar-i-Sharif', province: 'balkh', lat: 36.7050, lng: 67.1050 },
    // Jalalabad Hospitals
    { id: 'nangarhar-hospital', name: 'Nangarhar Regional Hospital', nameDari: 'شفاخانه منطقوی ننگرهار', type: 'hospital', city: 'Jalalabad', province: 'nangarhar', lat: 34.4380, lng: 70.4290 },

    // ====== AIRPORTS ======
    { id: 'kabul-airport', name: 'Hamid Karzai International Airport', nameDari: 'میدان هوایی بین‌المللی حامد کرزی', type: 'airport', city: 'Kabul', province: 'kabul', lat: 34.5659, lng: 69.2123, address: 'Kabul International Airport' },
    { id: 'herat-airport', name: 'Herat International Airport', nameDari: 'میدان هوایی بین‌المللی هرات', type: 'airport', city: 'Herat', province: 'herat', lat: 34.2100, lng: 62.2282 },
    { id: 'kandahar-airport', name: 'Kandahar International Airport', nameDari: 'میدان هوایی بین‌المللی کندهار', type: 'airport', city: 'Kandahar', province: 'kandahar', lat: 31.5058, lng: 65.8478 },
    { id: 'mazar-airport', name: 'Mazar-i-Sharif Airport', nameDari: 'میدان هوایی مزار شریف', type: 'airport', city: 'Mazar-i-Sharif', province: 'balkh', lat: 36.7509, lng: 67.2098 },
    { id: 'jalalabad-airport', name: 'Jalalabad Airport', nameDari: 'میدان هوایی جلال آباد', type: 'airport', city: 'Jalalabad', province: 'nangarhar', lat: 34.3998, lng: 70.4986 },
    { id: 'kunduz-airport', name: 'Kunduz Airport', nameDari: 'میدان هوایی کندز', type: 'airport', city: 'Kunduz', province: 'kunduz', lat: 36.6651, lng: 68.9108 },
    { id: 'bamyan-airport', name: 'Bamyan Airport', nameDari: 'میدان هوایی بامیان', type: 'airport', city: 'Bamyan', province: 'bamyan', lat: 34.8197, lng: 67.8198 },

    // ====== HOTELS ======
    { id: 'intercontinental-kabul', name: 'InterContinental Kabul', nameDari: 'هوتل انترکانتیننتال کابل', type: 'hotel', city: 'Kabul', province: 'kabul', lat: 34.5286, lng: 69.1361 },
    { id: 'serena-kabul', name: 'Serena Hotel Kabul', nameDari: 'هوتل سرینا کابل', type: 'hotel', city: 'Kabul', province: 'kabul', lat: 34.5270, lng: 69.1780 },
    { id: 'garden-inn-kabul', name: 'Garden Inn Hotel', nameDari: 'هوتل گارډن ان', type: 'hotel', city: 'Kabul', province: 'kabul', lat: 34.5290, lng: 69.1810 },
    { id: 'kabul-grand-hotel', name: 'Kabul Grand Hotel', nameDari: 'هوتل کابل گرند', type: 'hotel', city: 'Kabul', province: 'kabul', lat: 34.5220, lng: 69.1730 },
    { id: 'herat-marquis-hotel', name: 'Marquis Hotel Herat', nameDari: 'هوتل مارکیس هرات', type: 'hotel', city: 'Herat', province: 'herat', lat: 34.3520, lng: 62.1980 },
    { id: 'mazar-barat-hotel', name: 'Barat Hotel Mazar', nameDari: 'هوتل برات مزار', type: 'hotel', city: 'Mazar-i-Sharif', province: 'balkh', lat: 36.7090, lng: 67.1150 },
    { id: 'kandahar-crown-hotel', name: 'Crown Hotel Kandahar', nameDari: 'هوتل کراون کندهار', type: 'hotel', city: 'Kandahar', province: 'kandahar', lat: 31.6300, lng: 65.7400 },

    // ====== UNIVERSITIES ======
    { id: 'kabul-university', name: 'Kabul University', nameDari: 'پوهنتون کابل', type: 'university', city: 'Kabul', province: 'kabul', lat: 34.5072, lng: 69.1404 },
    { id: 'auaf-kabul', name: 'American University of Afghanistan', nameDari: 'پوهنتون امریکایی افغانستان', type: 'university', city: 'Kabul', province: 'kabul', lat: 34.5080, lng: 69.1950 },
    { id: 'kateb-university', name: 'Kateb University', nameDari: 'پوهنتون کاتب', type: 'university', city: 'Kabul', province: 'kabul', lat: 34.5130, lng: 69.1800 },
    { id: 'herat-university', name: 'Herat University', nameDari: 'پوهنتون هرات', type: 'university', city: 'Herat', province: 'herat', lat: 34.3450, lng: 62.1930 },
    { id: 'kandahar-university', name: 'Kandahar University', nameDari: 'پوهنتون کندهار', type: 'university', city: 'Kandahar', province: 'kandahar', lat: 31.6200, lng: 65.7200 },
    { id: 'balkh-university', name: 'Balkh University', nameDari: 'پوهنتون بلخ', type: 'university', city: 'Mazar-i-Sharif', province: 'balkh', lat: 36.7100, lng: 67.1200 },
    { id: 'nangarhar-university', name: 'Nangarhar University', nameDari: 'پوهنتون ننگرهار', type: 'university', city: 'Jalalabad', province: 'nangarhar', lat: 34.4420, lng: 70.4300 },

    // ====== MOSQUES ======
    { id: 'pul-e-khishti', name: 'Pul-e-Khishti Mosque', nameDari: 'جامع پل خشتی', type: 'mosque', city: 'Kabul', province: 'kabul', lat: 34.5186, lng: 69.1782 },
    { id: 'shah-do-shamshira', name: 'Shah-Do Shamshira Mosque', nameDari: 'جامع شاه دو شمشیره', type: 'mosque', city: 'Kabul', province: 'kabul', lat: 34.5195, lng: 69.1795 },
    { id: 'kabul-eid-gah', name: 'Kabul Eid Gah Mosque', nameDari: 'میدان عید گاه کابل', type: 'mosque', city: 'Kabul', province: 'kabul', lat: 34.5240, lng: 69.1680 },
    { id: 'blue-mosque-mazar', name: 'Blue Mosque (Rawze-e-Sharif)', nameDari: 'مسجد جامع مزار شریف (روضه شریف)', type: 'mosque', city: 'Mazar-i-Sharif', province: 'balkh', lat: 36.7073, lng: 67.1104 },
    { id: 'friday-mosque-herat', name: 'Great Friday Mosque Herat', nameDari: 'مسجد جامع هرات', type: 'mosque', city: 'Herat', province: 'herat', lat: 34.3420, lng: 62.1970 },

    // ====== GOVERNMENT / LANDMARKS ======
    { id: 'arg-palace', name: 'Arg Palace (Presidential Palace)', nameDari: 'ارگ ریاست جمهوری', type: 'government', city: 'Kabul', province: 'kabul', lat: 34.5280, lng: 69.1710 },
    { id: 'darul-aman-palace', name: 'Darul Aman Palace', nameDari: 'کاخ دارالامان', type: 'landmark', city: 'Kabul', province: 'kabul', lat: 34.4663, lng: 69.1128 },
    { id: 'gardens-of-babur', name: 'Gardens of Babur', nameDari: 'باغ بابر', type: 'park', city: 'Kabul', province: 'kabul', lat: 34.5130, lng: 69.1485 },
    { id: 'minaret-of-jam', name: 'Minaret of Jam', nameDari: 'مناره جام', type: 'landmark', city: 'Chaghcharan', province: 'ghor', lat: 34.3979, lng: 64.5145 },
    { id: 'buddhas-of-bamyan', name: 'Buddhas of Bamyan Site', nameDari: 'مجسمه‌های بودا بامیان', type: 'landmark', city: 'Bamyan', province: 'bamyan', lat: 34.8268, lng: 67.8259 },
    { id: 'herat-citadel', name: 'Herat Citadel (Qala Ikhtiyaruddin)', nameDari: 'ارگ هرات', type: 'landmark', city: 'Herat', province: 'herat', lat: 34.3455, lng: 62.1987 },
    { id: 'kabul-zoo', name: 'Kabul Zoo', nameDari: 'باغ وحش کابل', type: 'landmark', city: 'Kabul', province: 'kabul', lat: 34.5091, lng: 69.1740 },

    // ====== MARKETS ======
    { id: 'chicken-street', name: 'Chicken Street Market', nameDari: 'بازار چکن سترت', type: 'market', city: 'Kabul', province: 'kabul', lat: 34.5217, lng: 69.1789 },
    { id: 'mandawi-market', name: 'Mandawi Bazaar', nameDari: 'بازار مندوی', type: 'market', city: 'Kabul', province: 'kabul', lat: 34.5195, lng: 69.1822 },
    { id: 'shar-e-naw-market', name: 'Shar-e-Naw Shopping', nameDari: 'مارکیت شهر نو', type: 'market', city: 'Kabul', province: 'kabul', lat: 34.5285, lng: 69.1766 },
    { id: 'herat-bazaar', name: 'Herat Grand Bazaar', nameDari: 'بازار بزرگ هرات', type: 'market', city: 'Herat', province: 'herat', lat: 34.3420, lng: 62.1963 },
    { id: 'kandahar-bazaar', name: 'Kandahar Bazaar', nameDari: 'بازار کندهار', type: 'market', city: 'Kandahar', province: 'kandahar', lat: 31.6290, lng: 65.7320 },

    // ====== BUS STATIONS ======
    { id: 'kabul-bus-station', name: 'Kabul Bus Station (Pul-e-Mahmood Khan)', nameDari: 'بس استیشن کابل', type: 'bus_station', city: 'Kabul', province: 'kabul', lat: 34.5210, lng: 69.1900 },
    { id: 'herat-bus-station', name: 'Herat Bus Station', nameDari: 'بس استیشن هرات', type: 'bus_station', city: 'Herat', province: 'herat', lat: 34.3500, lng: 62.2010 },
    { id: 'mazar-bus-station', name: 'Mazar-i-Sharif Bus Station', nameDari: 'بس استیشن مزار شریف', type: 'bus_station', city: 'Mazar-i-Sharif', province: 'balkh', lat: 36.7060, lng: 67.1130 },
    { id: 'kandahar-bus-station', name: 'Kandahar Bus Station', nameDari: 'بس استیشن کندهار', type: 'bus_station', city: 'Kandahar', province: 'kandahar', lat: 31.6270, lng: 65.7380 },
    { id: 'jalalabad-bus-station', name: 'Jalalabad Bus Station', nameDari: 'بس استیشن جلال آباد', type: 'bus_station', city: 'Jalalabad', province: 'nangarhar', lat: 34.4350, lng: 70.4320 },
];

// POI Type labels for UI display
export const POI_TYPE_LABELS: Record<POI['type'], { en: string; fa: string; icon: string }> = {
    hospital: { en: 'Hospital', fa: 'شفاخانه', icon: '🏥' },
    airport: { en: 'Airport', fa: 'میدان هوایی', icon: '✈️' },
    hotel: { en: 'Hotel', fa: 'هوتل', icon: '🏨' },
    mosque: { en: 'Mosque', fa: 'مسجد', icon: '🕌' },
    university: { en: 'University', fa: 'پوهنتون', icon: '🎓' },
    market: { en: 'Market', fa: 'بازار', icon: '🛒' },
    government: { en: 'Government', fa: 'دولتی', icon: '🏛️' },
    landmark: { en: 'Landmark', fa: 'جاذبه گردشگری', icon: '🏛️' },
    park: { en: 'Park', fa: 'پارک', icon: '🌳' },
    bus_station: { en: 'Bus Station', fa: 'بس استیشن', icon: '🚌' },
};

/**
 * Search POIs and cities by query string (fuzzy match on name, nameDari, city, type).
 */
export function searchAfghanistanPlaces(query: string, limit: number = 10): Array<POI | City> {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();

    const results: Array<{ item: POI | City; score: number }> = [];

    // Search POIs
    for (const poi of AFGHANISTAN_POIS) {
        let score = 0;
        if (poi.name.toLowerCase().startsWith(q)) score = 10;
        else if (poi.name.toLowerCase().includes(q)) score = 7;
        else if (poi.nameDari.includes(q)) score = 7;
        else if (poi.city.toLowerCase().includes(q)) score = 4;
        else if (poi.type.includes(q)) score = 3;
        if (score > 0) results.push({ item: poi, score });
    }

    // Search Cities
    for (const city of AFGHANISTAN_CITIES) {
        let score = 0;
        if (city.name.toLowerCase().startsWith(q)) score = 9;
        else if (city.name.toLowerCase().includes(q)) score = 6;
        else if (city.nameDari.includes(q)) score = 6;
        if (score > 0) results.push({ item: city, score });
    }

    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(r => r.item);
}

/**
 * Get all cities of a province.
 */
export function getCitiesByProvince(provinceId: string): City[] {
    return AFGHANISTAN_CITIES.filter(c => c.province === provinceId);
}

/**
 * Get POIs near a coordinate (within radius km).
 */
export function getPOIsNearby(lat: number, lng: number, radiusKm: number = 5): POI[] {
    return AFGHANISTAN_POIS.filter(poi => {
        const d = Math.sqrt(Math.pow((poi.lat - lat) * 111, 2) + Math.pow((poi.lng - lng) * 85, 2));
        return d <= radiusKm;
    });
}
