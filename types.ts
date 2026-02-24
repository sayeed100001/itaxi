
export type UserRole = 'RIDER' | 'DRIVER' | 'ADMIN' | null;

export interface Location {
    lat: number;
    lng: number;
    bearing?: number; // 0-360 degrees
}

export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: UserRole;
    rating?: number;
    phone?: string;
    totalTrips?: number;
    balance?: number;
}

export type ServiceType = 'city' | 'intercity' | 'airport' | 'hotel' | 'scheduled' | 'subscription' | 'women';

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
    serviceClass?: 'standard' | 'comfort' | 'premium' | 'xl';
    scheduledFor?: string;
    womenOnly?: boolean;
    requestedFor?: { name: string; phone: string };
    bookingChannel?: 'APP' | 'PHONE';
    stops?: Array<{ lat: number; lng: number; label?: string }>;
    timestamp: number;
    distance: number;
    duration: number;
    route?: RouteData;
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

export interface DriverMarker {
    id: string;
    name: string;
    vehicle: string;
    rating: number;
    location: Location;
    status: 'available' | 'busy' | 'offline' | 'suspended';
    baseFare: number; // Driver set base fare
    perKmRate: number; // Driver set per km rate
    type: 'eco' | 'plus' | 'lux';
    distance?: number; // Calculated distance to rider
    eta?: number; // Calculated ETA
    phone?: string;
    email?: string;
    licensePlate?: string;
    totalRides?: number;
    earnings?: number;
    joinDate?: number;
    creditBalance?: number;
}

export interface RouteData {
    coordinates: [number, number][]; // Array of [lat, lng]
    distance: number; // meters
    duration: number; // seconds
    bbox?: [number, number, number, number];
}

export type RoutingProviderType = 'ors' | 'mapbox';
export type MapProviderType = 'osm' | 'mapbox' | 'google';

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

export interface AppNotification {
    id: string;
    type: 'promo' | 'system' | 'success' | 'alert';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}

export interface ChatState {
    isOpen: boolean;
    tripId?: string;
    recipientId: string;
    recipientName: string;
    recipientRole: string;
}
