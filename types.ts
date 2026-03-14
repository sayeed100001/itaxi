
export type UserRole = 'rider' | 'driver' | 'admin' | null;

export interface Location {
    lat: number;
    lng: number;
    bearing?: number; // 0-360 degrees
}

export interface SavedPlace {
    name: string; // 'Home' | 'Work' | Custom
    address: string;
    location: Location;
}

export interface User {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    avatar?: string;
    role: UserRole;
    rating?: number;
    totalTrips?: number;
    balance?: number;
    savedPlaces?: SavedPlace[];
    loyaltyPoints?: number; // امتیاز وفاداری
    discountPercent?: number; // درصد تخفیف فعلی
}

export type ServiceType = 'city' | 'intercity' | 'airport' | 'hotel' | 'scheduled' | 'subscription' | 'package';

export interface Ride {
    id: string;
    pickup: string;
    destination: string;
    pickupLocation: Location;
    destinationLocation: Location;
    fare: number; // Final agreed fare
    proposedFare?: number; // Negotiation start
    status: 'searching' | 'negotiating' | 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
    driverId?: string;
    riderId: string;
    serviceType: ServiceType;
    taxiTypeId?: 'eco' | 'plus' | 'lux' | 'premium';
    timestamp: number;
    distance: number;
    duration: number;
    route?: RouteData;
    notes?: string;
    scheduledTime?: string; // زمان رزرو شده
    riderRating?: number; // رتبه مسافر به راننده
    driverRating?: number; // رتبه راننده به مسافر
}

export interface Hotel {
    id: string;
    name: string;
    address: string;
    rating: number;
    priceRange: string;
    location: Location;
    image: string;
    commission: number;
}

export type PoiCategory =
    | 'hotel'
    | 'airport'
    | 'mall'
    | 'shopping'
    | 'restaurant'
    | 'hospital'
    | 'fuel'
    | 'landmark'
    | 'poi';

export interface Poi {
    id: string;
    name: string;
    category: PoiCategory;
    location: Location;
    address?: string;
    source?: 'osm' | 'manual';
}

export interface DriverMarker {
    id: string;
    name: string;
    vehicle: string;
    rating: number;
    location: Location;
    status: 'available' | 'busy' | 'offline' | 'suspended';
    baseFare: number; // Driver set base fare
    perKmRate: number; // Driver set per km rate
    type: 'eco' | 'plus' | 'lux' | 'premium';
    serviceTypes?: string[];
    distance?: number; // Calculated distance to rider
    eta?: number; // Calculated ETA
    phone?: string;
    licensePlate?: string;
    totalRides?: number;
    earnings?: number;
    joinDate?: number;
}

export interface RouteData {
    coordinates: [number, number][]; // Array of [lat, lng]
    distance: number; // meters
    duration: number; // seconds
    bbox?: [number, number, number, number];
}

export type RoutingProviderType = 'ors' | 'mapbox' | 'mock';
export type MapProviderType = 'osm' | 'mapbox' | 'google';

export type LoginOtpChannel = 'whatsapp' | 'email';

export interface LoginOtpSettings {
    enabled: boolean;
    roles: Array<Exclude<UserRole, null>>;
    channels: LoginOtpChannel[];
    defaultChannel: LoginOtpChannel;
    ttlSeconds: number;
    maxAttempts: number;
}

export interface ServiceClass {
    id: string;
    name: string;
    baseFare: number;
    perKm: number;
    perMin: number;
    minFare: number;
    commission: number;
    icon: string;
}

export interface AdminSettings {
    routingProvider: RoutingProviderType;
    mapProvider: MapProviderType;
    apiKeys: {
        ors: string;
        mapbox: string;
        google: string;
    };
    pricing: {
        minFare: number;
        commissionRate: number; // Percentage
        cancellationFee: number;
        intercityMultiplier: number;
    };
    services: ServiceClass[];
    system: {
        defaultCenter: Location;
        driverUpdateInterval: number;
        enableManualFare: boolean;
        radiusLimit: number; // km
        dispatchTimeout: number; // seconds
    };
    hotelsModule: {
        enabled: boolean;
        commission: number;
    };
    auth?: {
        loginOtp?: LoginOtpSettings;
    };
}

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
}

export interface Transaction {
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    date: number;
    description: string;
    status: 'completed' | 'pending' | 'failed';
}

export interface WithdrawalRequest {
    id: string;
    driverId: string;
    driverName: string;
    amount: number;
    method: string; // 'Bank Transfer' | 'Cash' | 'Wallet'
    status: 'pending' | 'approved' | 'rejected';
    requestDate: number;
    processedDate?: number;
    accountDetails?: string;
}

export interface CreditRequest {
    id: string;
    driverId: string;
    driverName: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    requestDate: number;
    processedDate?: number;
}

export interface USDTRequest {
    id: string;
    userId: string;
    userName: string;
    amountUsdt: number;
    amountIpay: number;
    walletAddress: string;
    status: 'pending' | 'approved' | 'rejected';
    requestDate: number;
    processedDate?: number;
}

export interface AppNotification {
    id: string;
    type: 'promo' | 'system' | 'success' | 'alert';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}

export interface ChatMessage {
    id: string;
    text: string;
    sender: 'me' | 'other';
    time: string;
}

export interface ChatState {
    isOpen: boolean;
    recipientId: string;
    recipientName: string;
    recipientRole: string;
    messages: Record<string, ChatMessage[]>; // Keyed by recipientId
}
