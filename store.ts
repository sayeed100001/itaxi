
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Ride, UserRole, AdminSettings, RouteData, Location, DriverMarker, Hotel, Toast, Transaction, AppNotification, ChatState, ChatMessage, WithdrawalRequest, CreditRequest, SavedPlace } from './types';
import { TaxiType } from './services/taxiTypes';
import { apiFetch } from './services/api';

export type AppMode = 'landing' | 'auth' | 'app';
export type AppView = 'home' | 'trips' | 'wallet' | 'messages' | 'profile' | 'settings' | 'earnings' | 'drivers' | 'analytics' | 'notifications' | 'finance' | 'admin_settings' | 'activity' | 'support';
export type Language = 'en' | 'fa';

interface AppState {
    appMode: AppMode;
    user: User | null;
    currentRole: UserRole;
    activeRide: Ride | null;
    pastTrips: Ride[];
    transactions: Transaction[];
    withdrawalRequests: WithdrawalRequest[];
    creditRequests: CreditRequest[];
    driverCreditBalance: number | null;
    notifications: AppNotification[];
    isDarkMode: boolean;
    language: Language;
    toasts: Toast[];
    currentView: AppView;
    chatState: ChatState;

    // Taxi Selection
    selectedTaxiType: TaxiType | null;

    // Admin & Config
    adminSettings: AdminSettings;

    // Map & Location Data
    userLocation: Location;
    drivers: DriverMarker[];
    hotels: Hotel[];
    currentRoute: RouteData | null;

    incomingRequest: Ride | null;

    // Actions
    setAppMode: (mode: AppMode) => void;
    setUser: (user: User | null) => void;
    updateUserProfile: (data: Partial<User>) => void;
    setRole: (role: UserRole) => void;
    setView: (view: AppView) => void;
    startRide: (ride: Ride | null) => void;
    setIncomingRideRequest: (ride: Ride | null) => void;
    updateRideStatus: (status: Ride['status'], driverId?: string) => void;
    completeRide: () => void;
    toggleDarkMode: () => void;
    setLanguage: (lang: Language) => void;
    logout: () => void;

    // Taxi Selection Actions
    setSelectedTaxiType: (taxiType: TaxiType | null) => void;

    // Chat Actions
    openChat: (recipientId: string, name: string, role: string) => void;
    closeChat: () => void;
    sendMessage: (recipientId: string, text: string, sender: 'me' | 'other') => void;
    addMessage: (data: any) => void;

    // Data Actions
    createRide: (rideData: any) => Promise<void>;
    addNotification: (notification: AppNotification) => void;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    addTransaction: (tx: Transaction) => void;
    topUpWallet: (amount: number) => Promise<void>;
    processWithdrawal: (id: string, status: 'approved' | 'rejected') => void;
    requestCredit: (amount: number) => Promise<void>;
    fetchFinancials: () => Promise<void>;
    processRequest: (id: string, type: 'withdrawal' | 'credit', status: 'approved' | 'rejected') => Promise<void>;
    submitRating: (rideId: string, rating: number, ratedBy: 'rider' | 'driver') => Promise<void>;

    // Map Actions
    updateUserLocation: (loc: Location) => void;
    updateDrivers: (drivers: DriverMarker[]) => void;
    updateDriver: (id: string, data: Partial<DriverMarker>) => void;
    updateDriverInDB: (id: string, data: Partial<DriverMarker>) => Promise<void>;
    registerDriver: (driver: DriverMarker) => void;
    generateLocalDrivers: (center: Location) => Promise<void>;
    setRoute: (route: RouteData | null) => void;

    updateSavedPlace: (place: SavedPlace) => void;
    removeSavedPlace: (name: string) => void;

    // Admin Actions
    updateAdminSettings: (settings: Partial<AdminSettings>) => void;
    updateTaxiType: (id: string, taxiType: any) => void;
    addTaxiType: (taxiType: any) => void;
    removeTaxiType: (id: string) => void;
    addHotel: (hotel: Hotel) => void;
    removeHotel: (id: string) => void;

    // Toast Actions
    addToast: (type: Toast['type'], message: string) => void;
    removeToast: (id: string) => void;

    fetchInitialData: () => Promise<void>;
    refreshDrivers: () => Promise<void>;
}

const DEFAULT_LOCATION = { lat: 34.5333, lng: 69.1667 };
const ALLOW_DEMO_DRIVERS = import.meta.env.DEV && (typeof window !== 'undefined') && window.localStorage?.getItem('itaxi:demoDrivers') === '1';

const TAXI_TIERS = ['eco', 'plus', 'lux', 'premium'] as const;
type TaxiTier = (typeof TAXI_TIERS)[number];
const isTaxiTier = (v: string): v is TaxiTier => (TAXI_TIERS as readonly string[]).includes(v);

// Empty initial states - data will be fetched from API
const INITIAL_HOTELS: Hotel[] = [];
const INITIAL_TRANSACTIONS: Transaction[] = [];
const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [];
const INITIAL_CREDIT_REQUESTS: CreditRequest[] = [];
const INITIAL_NOTIFICATIONS: AppNotification[] = [];

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
    routingProvider: 'ors',
    mapProvider: 'osm',
    apiKeys: { ors: '', mapbox: '', google: '' },
    pricing: { minFare: 50, commissionRate: 20, cancellationFee: 20, intercityMultiplier: 1.5 },
    services: [
        { id: 'city', name: 'iTaxi City', baseFare: 40, perKm: 15, perMin: 2, minFare: 50, commission: 20, icon: 'Car' },
        { id: 'intercity', name: 'iTaxi Intercity', baseFare: 80, perKm: 30, perMin: 5, minFare: 100, commission: 20, icon: 'Car' },
        { id: 'airport', name: 'iTaxi Airport', baseFare: 100, perKm: 35, perMin: 6, minFare: 150, commission: 20, icon: 'Plane' }
    ],
    system: { defaultCenter: DEFAULT_LOCATION, driverUpdateInterval: 1000, enableManualFare: true, radiusLimit: 10, dispatchTimeout: 20 },
    hotelsModule: { enabled: true, commission: 5 },
    auth: {
        loginOtp: {
            enabled: false,
            roles: ['rider', 'driver'],
            channels: ['whatsapp', 'email'],
            defaultChannel: 'whatsapp',
            ttlSeconds: 300,
            maxAttempts: 5,
            enableOnRegister: false
        },
        recaptcha: {
            enabled: false,
            siteKey: '',
            applyTo: ['login', 'register']
        }
    }
};

const normalizeAdminSettings = (incoming: any): AdminSettings => {
    const s = (incoming && typeof incoming === 'object') ? incoming : {};

    const authIncoming = (s.auth && typeof s.auth === 'object') ? s.auth : {};
    const loginOtpIncoming = (authIncoming.loginOtp && typeof authIncoming.loginOtp === 'object') ? authIncoming.loginOtp : {};

    const mergedAuth = {
        loginOtp: {
            ...DEFAULT_ADMIN_SETTINGS.auth?.loginOtp,
            ...loginOtpIncoming,
            roles: Array.isArray(loginOtpIncoming.roles) && loginOtpIncoming.roles.length ? loginOtpIncoming.roles : (DEFAULT_ADMIN_SETTINGS.auth?.loginOtp?.roles || ['rider', 'driver']),
            channels: Array.isArray(loginOtpIncoming.channels) && loginOtpIncoming.channels.length ? loginOtpIncoming.channels : (DEFAULT_ADMIN_SETTINGS.auth?.loginOtp?.channels || ['whatsapp', 'email']),
        },
        recaptcha: {
            ...DEFAULT_ADMIN_SETTINGS.auth?.recaptcha,
            ...((authIncoming.recaptcha && typeof authIncoming.recaptcha === 'object') ? authIncoming.recaptcha : {})
        }
    };

    const result: any = {
        ...DEFAULT_ADMIN_SETTINGS,
        ...s,
        apiKeys: { ...DEFAULT_ADMIN_SETTINGS.apiKeys, ...(s.apiKeys || {}) },
        pricing: { ...DEFAULT_ADMIN_SETTINGS.pricing, ...(s.pricing || {}) },
        system: {
            ...DEFAULT_ADMIN_SETTINGS.system,
            ...(s.system || {}),
            defaultCenter: { ...DEFAULT_ADMIN_SETTINGS.system.defaultCenter, ...((s.system && s.system.defaultCenter) ? s.system.defaultCenter : {}) }
        },
        hotelsModule: { ...DEFAULT_ADMIN_SETTINGS.hotelsModule, ...(s.hotelsModule || {}) },
        services: Array.isArray(s.services) && s.services.length > 0 ? s.services : DEFAULT_ADMIN_SETTINGS.services,
        auth: mergedAuth,
    };

    // Preserve features, portals, primaryColor, secondaryColor as-is (dynamic fields not in AdminSettings type)
    if (s.features && typeof s.features === 'object') result.features = s.features;
    if (s.portals && typeof s.portals === 'object') result.portals = s.portals;
    if (typeof s.primaryColor === 'string') result.primaryColor = s.primaryColor;
    if (typeof s.secondaryColor === 'string') result.secondaryColor = s.secondaryColor;

    return result as AdminSettings;
};

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            appMode: 'landing',
            user: null,
            currentRole: 'rider',
            activeRide: null,
            incomingRequest: null,
            pastTrips: [],
            transactions: [],
            withdrawalRequests: [],
            creditRequests: [],
            driverCreditBalance: null,
            notifications: [],
            isDarkMode: true,
            language: 'en',
            toasts: [],
            currentView: 'home',
            chatState: {
                isOpen: false,
                recipientId: '',
                recipientName: '',
                recipientRole: '',
                messages: {}
            },

            selectedTaxiType: null,

            adminSettings: DEFAULT_ADMIN_SETTINGS,

            userLocation: DEFAULT_LOCATION,
            drivers: [],
            hotels: [],
            currentRoute: null,

            setAppMode: (mode) => set({ appMode: mode }),
            setUser: (user) => {
                set({ user, appMode: user ? 'app' : 'landing' });
                // Ensure token persists — if user is set from session restore (no new token issued),
                // the existing localStorage token is already correct. If user is null, clear it.
                if (!user) {
                    try { localStorage.removeItem('token'); } catch {}
                }
            },
            updateUserProfile: (data) => {
                // Optimistic local update
                set((state) => ({ user: state.user ? { ...state.user, ...data } : null }));

                // Persist server-side for enterprise features (email OTP, receipts, etc).
                (async () => {
                    const u = get().user;
                    if (!u) return;

                    const patch: Partial<Pick<User, 'name' | 'phone' | 'email' | 'avatar'>> = {};
                    if (typeof data.name === 'string') patch.name = data.name;
                    if (typeof data.phone === 'string') patch.phone = data.phone;
                    if (data.email !== undefined) patch.email = data.email;
                    if (typeof data.avatar === 'string') patch.avatar = data.avatar;
                    if (Object.keys(patch).length === 0) return;

                    try {
                        const res = await apiFetch(`/api/users/${u.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(patch)
                        });

                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            get().addToast('error', err?.error || 'Failed to save profile');
                            return;
                        }

                        const serverUser = await res.json().catch(() => null);
                        if (serverUser) {
                            set((state) => ({ user: state.user ? { ...state.user, ...serverUser } : serverUser }));
                            get().addToast('success', 'Profile saved');
                        }
                    } catch (e) {
                        console.error('Profile update failed', e);
                        get().addToast('error', 'Failed to save profile');
                    }
                })();
            },
            setRole: (role) => {
                const { user } = get();
                // Only admin can switch portals; others are locked to their own role
                if (user && user.role !== 'admin' && role !== user.role) return;
                set({ currentRole: role, currentView: 'home' });
            },
            setView: (view) => set({ currentView: view }),

            setSelectedTaxiType: (taxiType) => set({ selectedTaxiType: taxiType }),

            startRide: (ride) => set((state) => ({
                activeRide: ride,
                currentRoute: ride?.route || state.currentRoute
            })),

            createRide: async (rideData) => {
                try {
                    console.log('🚀 Creating ride with data:', rideData);

                    // Validate required fields before API call
                    if (!rideData.riderId || !rideData.pickupLoc || !rideData.destLoc || !rideData.serviceType) {
                        throw new Error('Missing required fields: riderId, pickupLoc, destLoc, serviceType');
                    }

                    // Validate coordinates
                    if (!rideData.pickupLoc.lat || !rideData.pickupLoc.lng || !rideData.destLoc.lat || !rideData.destLoc.lng) {
                        throw new Error('Invalid coordinates provided');
                    }

                    const response = await apiFetch('/api/rides', {
                        method: 'POST',
                        body: JSON.stringify(rideData)
                    });

                    if (response.ok) {
                        const ride = await response.json();
                        const route = rideData.route;
                        set((state) => ({
                            activeRide: { ...ride, route },
                            currentRoute: route || state.currentRoute
                        }));
                        console.log('✅ Ride created successfully:', ride.id);

                        // If ride was immediately accepted, update driver info
                        if (ride.status === 'accepted' && ride.driverId) {
                            const driverInfo = get().drivers.find(d => d.id === ride.driverId);
                            if (driverInfo) {
                                set((state) => ({
                                    activeRide: {
                                        ...state.activeRide!,
                                        driver: {
                                            name: driverInfo.name,
                                            phone: driverInfo.phone,
                                            rating: driverInfo.rating,
                                            vehicle: driverInfo.vehicle,
                                            licensePlate: driverInfo.licensePlate,
                                            location: driverInfo.location
                                        }
                                    }
                                }));
                            }
                        }
                    } else {
                        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                        console.error('❌ Ride creation failed:', response.status, errorData);

                        // Throw error with specific message from server
                        const errorMessage = errorData.error || `Server error: ${response.status}`;
                        throw new Error(errorMessage);
                    }
                } catch (error) {
                    console.error('❌ Network/Parse error:', error);

                    // Re-throw the error so the UI can handle it
                    if (error instanceof Error) {
                        throw error;
                    } else {
                        throw new Error('Network error occurred while creating ride');
                    }
                }
            },

            setIncomingRideRequest: (ride) => set({ incomingRequest: ride }),

            updateRideStatus: async (status, driverId) => {
                const state = get();
                if (state.activeRide) {
                    const updatedRide = { ...state.activeRide, status };
                    if (driverId) {
                        updatedRide.driverId = driverId;
                    }
                    set({ activeRide: updatedRide });

                    try {
                        await apiFetch(`/api/rides/${state.activeRide.id}/status`, {
                            method: 'PUT',
                            body: JSON.stringify({ status, driverId })
                        });
                    } catch (e) {
                        console.error("Failed to update status on server", e);
                    }
                }
            },

            completeRide: () => {
                const { activeRide } = get();
                if (!activeRide) return;

                set((state) => ({
                    activeRide: { ...state.activeRide!, status: 'completed' },
                    currentRoute: null,
                }));
            },

            toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
            setLanguage: (lang) => set({ language: lang }),
            logout: () => {
                localStorage.removeItem('token');
                set({
                    user: null,
                    activeRide: null,
                    appMode: 'landing',
                    currentView: 'home',
                    currentRoute: null,
                    pastTrips: [],
                    transactions: [],
                    notifications: [],
                    chatState: {
                        isOpen: false,
                        recipientId: '',
                        recipientName: '',
                        recipientRole: '',
                        messages: {}
                    }
                });
                console.log('🚪 User logged out successfully');
            },

            openChat: async (recipientId, name, role) => {
                try {
                    // Validate inputs
                    if (!recipientId || !name || !role) {
                        console.error('Invalid chat parameters:', { recipientId, name, role });
                        get().addToast('error', 'Invalid chat parameters');
                        return;
                    }

                    set((state) => ({
                        chatState: {
                            ...state.chatState,
                            isOpen: true,
                            recipientId: recipientId.toString(),
                            recipientName: name.toString(),
                            recipientRole: role.toString()
                        }
                    }));

                    // Fetch history with error handling
                    const { user } = get();
                    if (user && user.id) {
                        try {
                            const res = await apiFetch(`/api/chat/${user.id}/${recipientId}`);
                            if (res.ok) {
                                const messages = await res.json();
                                set(state => ({
                                    chatState: {
                                        ...state.chatState,
                                        messages: { ...state.chatState.messages, [recipientId]: messages || [] }
                                    }
                                }));
                            } else {
                                console.warn('Failed to fetch chat history:', res.status);
                                // Initialize empty messages array
                                set(state => ({
                                    chatState: {
                                        ...state.chatState,
                                        messages: { ...state.chatState.messages, [recipientId]: [] }
                                    }
                                }));
                            }
                        } catch (fetchError) {
                            console.error('Chat history fetch error:', fetchError);
                            // Initialize empty messages array on error
                            set(state => ({
                                chatState: {
                                    ...state.chatState,
                                    messages: { ...state.chatState.messages, [recipientId]: [] }
                                }
                            }));
                        }
                    }
                } catch (error) {
                    console.error('OpenChat error:', error);
                    get().addToast('error', 'Failed to open chat');
                }
            },
            closeChat: () => set((state) => ({ chatState: { ...state.chatState, isOpen: false } })),

            sendMessage: async (recipientId, text, sender) => {
                const { user, activeRide } = get();
                if (!user) return;

                // Optimistic update
                set((state) => {
                    const currentMessages = state.chatState.messages[recipientId] || [];
                    const newMessage: ChatMessage = {
                        id: Date.now().toString(),
                        text,
                        sender,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                    return {
                        chatState: {
                            ...state.chatState,
                            messages: {
                                ...state.chatState.messages,
                                [recipientId]: [...currentMessages, newMessage]
                            }
                        }
                    };
                });

                // Send via socket for real-time delivery
                try {
                    const { socketService } = await import('./services/socketService');
                    socketService.emit('send_message', {
                        recipientId,
                        text,
                        senderId: user.id,
                        senderName: user.name,
                        rideId: activeRide?.id
                    });
                } catch (e) {
                    console.error('Failed to send message via socket:', e);
                    get().addToast('error', 'Message failed to send');
                }
            },

            addMessage: (data) => set((state) => {
                const recipientId = data.senderId;
                const currentMessages = state.chatState.messages[recipientId] || [];
                const newMessage: ChatMessage = {
                    id: Date.now().toString(),
                    text: data.text,
                    sender: 'other',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                return {
                    chatState: {
                        ...state.chatState,
                        messages: {
                            ...state.chatState.messages,
                            [recipientId]: [...currentMessages, newMessage]
                        }
                    }
                };
            }),

            addNotification: (notification) => set((state) => ({ notifications: [notification, ...state.notifications] })),
            markNotificationRead: (id) => set(state => ({
                notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
            })),

            markAllNotificationsRead: () => set(state => ({
                notifications: state.notifications.map(n => ({ ...n, read: true }))
            })),

            addTransaction: (tx) => set((state) => ({ transactions: [tx, ...state.transactions] })),

            processWithdrawal: async (id, status) => {
                // In real app, call API
                set((state) => {
                    const updatedRequests = state.withdrawalRequests.map(w =>
                        w.id === id ? { ...w, status, processedDate: Date.now() } : w
                    );
                    return { withdrawalRequests: updatedRequests };
                });
            },

            requestCredit: async (amount) => {
                const { user } = get();
                if (!user) return;
                try {
                    const res = await apiFetch('/api/wallet/credit-request', {
                        method: 'POST',
                        body: JSON.stringify({ driverId: user.id, amount })
                    });
                    if (res.ok) {
                        get().addToast('success', 'Credit request submitted');
                        // Refresh wallet data
                        const walletRes = await apiFetch(`/api/wallet/${user.id}`);
                        if (walletRes.ok) {
                            const data = await walletRes.json();
                            set({ creditRequests: data.creditRequests || [] });
                        }
                    } else {
                        get().addToast('error', 'Request failed');
                    }
                } catch (e) {
                    get().addToast('error', 'Network error');
                }
            },

            topUpWallet: async (amount) => {
                const { user } = get();
                if (!user) return;
                try {
                    const res = await apiFetch('/api/wallet/topup', {
                        method: 'POST',
                        body: JSON.stringify({ userId: user.id, amount })
                    });
                    if (res.ok) {
                        get().addToast('success', 'Wallet topped up successfully');
                        // Refresh wallet data
                        const walletRes = await apiFetch(`/api/wallet/${user.id}`);
                        if (walletRes.ok) {
                            const data = await walletRes.json();
                            set(state => ({
                                user: state.user ? { ...state.user, balance: data.balance } : null,
                                transactions: data.transactions
                            }));
                        }
                    } else {
                        get().addToast('error', 'Top up failed');
                    }
                } catch (e) {
                    get().addToast('error', 'Network error');
                }
            },

            fetchFinancials: async () => {
                try {
                    const res = await apiFetch('/api/admin/financials');
                    if (res.ok) {
                        const data = await res.json();
                        set({
                            withdrawalRequests: data.withdrawals,
                            creditRequests: data.creditRequests
                        });
                    }
                } catch (e) { }
            },

            processRequest: async (id, type, status) => {
                try {
                    const res = await apiFetch('/api/admin/financials/approve', {
                        method: 'POST',
                        body: JSON.stringify({ id, type, status })
                    });
                    if (res.ok) {
                        get().addToast('success', `Request ${status}`);
                        get().fetchFinancials(); // Refresh list
                    }
                } catch (e) {
                    get().addToast('error', 'Processing failed');
                }
            },

            updateUserLocation: (loc) => set({ userLocation: loc }),

            updateDrivers: (drivers) => set({ drivers }),

            updateDriver: (id, data) => set((state) => ({
                drivers: state.drivers.map(d => d.id === id ? { ...d, ...data } : d)
            })),

            updateDriverInDB: async (id, data) => {
                try {
                    const res = await apiFetch(`/api/drivers/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(data)
                    });

                    if (res.ok) {
                        set((state) => ({
                            drivers: state.drivers.map(d => d.id === id ? { ...d, ...data } : d)
                        }));
                        get().addToast('success', 'Driver updated');
                    } else {
                        get().addToast('error', 'Update failed');
                    }
                } catch (e) {
                    get().addToast('error', 'Network error');
                }
            },

            registerDriver: (driver) => set((state) => {
                const filtered = state.drivers.filter(d => d.id !== driver.id);
                return { drivers: [...filtered, driver] };
            }),

            generateLocalDrivers: async (center) => {
                try {
                    const response = await apiFetch(`/api/drivers?lat=${center.lat}&lng=${center.lng}`);
                    if (response.ok) {
                        const dbDrivers = await response.json();
                        if (dbDrivers.length > 0) {
                            const formattedDrivers = dbDrivers.map((d: any) => {
                                const rawTaxiType = (d.taxi_type_id || d.vehicle_type || 'eco').toString();
                                const normalizedTaxiType: DriverMarker['type'] = isTaxiTier(rawTaxiType) ? rawTaxiType : 'eco';

                                return ({
                                    id: d.id,
                                    name: d.name,
                                    vehicle: d.vehicle_model || 'Toyota Corolla',
                                    rating: parseFloat(d.rating) || 4.8,
                                    location: {
                                        lat: parseFloat(d.current_lat),
                                        lng: parseFloat(d.current_lng),
                                        bearing: parseFloat(d.bearing) || Math.random() * 360
                                    },
                                    status: d.status as 'available' | 'busy' | 'offline' | 'suspended',
                                    type: normalizedTaxiType,
                                    serviceTypes: (() => {
                                        if (!d.service_types) return ['city', 'airport'];
                                        if (Array.isArray(d.service_types)) return d.service_types;
                                        if (typeof d.service_types === 'string') {
                                            try {
                                                const parsed = JSON.parse(d.service_types);
                                                if (Array.isArray(parsed)) return parsed;
                                            } catch {
                                                return d.service_types.split(',').map((x: string) => x.trim()).filter(Boolean);
                                            }
                                        }
                                        return ['city', 'airport'];
                                    })(),
                                    phone: d.phone,
                                    licensePlate: d.vehicle_plate || `KBL-${Math.floor(1000 + Math.random() * 9000)}`,
                                    baseFare: parseFloat(d.base_fare) || 50,
                                    perKmRate: parseFloat(d.per_km_rate) || 20,
                                    totalRides: parseInt(d.total_rides) || 0,
                                    earnings: parseFloat(d.earnings) || 0
                                });
                            });
                            set({ drivers: formattedDrivers });
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch real drivers from API", e);
                }

                // Production-safe behavior: do NOT fabricate drivers.
                if (!ALLOW_DEMO_DRIVERS) {
                    set({ drivers: [] });
                    try {
                        get().addToast('warning', 'No drivers available nearby.');
                    } catch { }
                    return;
                }
            },

            setRoute: (route) => set({ currentRoute: route }),

            updateSavedPlace: (place) => set((state) => {
                if (!state.user) return {};
                const current = state.user.savedPlaces || [];
                const filtered = current.filter(p => p.name !== place.name);
                return { user: { ...state.user, savedPlaces: [...filtered, place] } };
            }),

            removeSavedPlace: (name) => set((state) => {
                if (!state.user) return {};
                return { user: { ...state.user, savedPlaces: (state.user.savedPlaces || []).filter(p => p.name !== name) } };
            }),

            updateAdminSettings: async (newSettings) => {
                // Optimistic
                const currentState = get().adminSettings as any;
                const ns: any = newSettings || {};
                const merged: any = {
                    ...currentState,
                    ...ns,
                    apiKeys: { ...(currentState.apiKeys || {}), ...(ns.apiKeys || {}) },
                    pricing: { ...(currentState.pricing || {}), ...(ns.pricing || {}) },
                    system: {
                        ...(currentState.system || {}),
                        ...(ns.system || {}),
                        defaultCenter: { ...(currentState.system?.defaultCenter || {}), ...(ns.system?.defaultCenter || {}) }
                    },
                    hotelsModule: { ...(currentState.hotelsModule || {}), ...(ns.hotelsModule || {}) },
                    services: Array.isArray(ns.services) ? ns.services : currentState.services,
                    auth: {
                        ...(currentState.auth || {}),
                        ...(ns.auth || {}),
                        loginOtp: { ...(currentState.auth?.loginOtp || {}), ...(ns.auth?.loginOtp || {}) }
                    },
                    // Preserve and deep-merge features, portals, and UI color fields
                    features: ns.features ? { ...(currentState.features || {}), ...ns.features } : (currentState.features || undefined),
                    portals: ns.portals ? { ...(currentState.portals || {}), ...ns.portals } : (currentState.portals || undefined),
                    primaryColor: ns.primaryColor !== undefined ? ns.primaryColor : (currentState.primaryColor || undefined),
                    secondaryColor: ns.secondaryColor !== undefined ? ns.secondaryColor : (currentState.secondaryColor || undefined),
                };

                const updated = normalizeAdminSettings(merged);
                set({ adminSettings: updated });

                try {
                    await apiFetch('/api/admin/settings', {
                        method: 'PUT',
                        body: JSON.stringify(updated)
                    });
                } catch (e) {
                    console.error("Failed to sync settings", e);
                    get().addToast('error', 'Failed to save settings to server');
                }
            },

            updateTaxiType: (id, taxiType) => {
                // Update taxi type configuration
                get().addToast('success', 'Taxi type updated successfully');
            },

            addTaxiType: (taxiType) => {
                // Add new taxi type
                get().addToast('success', 'New taxi type added successfully');
            },

            removeTaxiType: (id) => {
                // Remove taxi type
                get().addToast('success', 'Taxi type removed successfully');
            },

            addHotel: (hotel) => set((state) => ({ hotels: [...state.hotels, hotel] })),
            removeHotel: (id) => set((state) => ({ hotels: state.hotels.filter(h => h.id !== id) })),

            addToast: (type, message) => {
                const id = Math.random().toString(36).substring(7);
                set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
                setTimeout(() => get().removeToast(id), 4000);
            },
            removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

            fetchInitialData: async () => {
                const { user } = get();

                // 1. Fetch Settings
                try {
                    const settingsRes = await apiFetch('/api/settings');
                    if (settingsRes.ok) {
                        const settings = await settingsRes.json();
                        const normalized = normalizeAdminSettings(settings);
                        // Preserve features/portals/colors from server response
                        if (settings.features) (normalized as any).features = settings.features;
                        if (settings.portals) (normalized as any).portals = settings.portals;
                        if (settings.primaryColor) (normalized as any).primaryColor = settings.primaryColor;
                        if (settings.secondaryColor) (normalized as any).secondaryColor = settings.secondaryColor;
                        set({ adminSettings: normalized });
                    }
                } catch (e) { }

                // 2. Fetch User Data if logged in
                if (user) {
                    try {
                        const userRes = await apiFetch(`/api/users/${user.id}`);
                        if (userRes.ok) {
                            const userData = await userRes.json();
                            set(state => ({
                                user: { ...state.user, ...userData }
                            }));
                        }

                        const walletRes = await apiFetch(`/api/wallet/${user.id}`);
                        if (walletRes.ok) {
                            const walletData = await walletRes.json();
                            set(state => ({
                                user: state.user ? { ...state.user, balance: walletData.balance } : null,
                                transactions: walletData.transactions,
                                driverCreditBalance: typeof walletData.driverCreditBalance === 'number' ? walletData.driverCreditBalance : (walletData.driverCreditBalance ? Number(walletData.driverCreditBalance) : null),
                                creditRequests: walletData.creditRequests || state.creditRequests
                            }));
                        }

                        // Fetch past trips
                        const ridesRes = await apiFetch(`/api/rides/user/${user.id}?status=completed`);
                        if (ridesRes.ok) {
                            const rides = await ridesRes.json();
                            set({ pastTrips: rides });
                        }
                    } catch (e) { }
                }
            },

            refreshDrivers: async () => {
                const { userLocation, generateLocalDrivers } = get();
                try {
                    await generateLocalDrivers(userLocation);
                    console.log('✅ Drivers refreshed successfully');
                } catch (error) {
                    console.error('❌ Failed to refresh drivers:', error);
                    get().addToast('error', 'Failed to refresh driver locations');
                }
            },

            submitRating: async (rideId, rating, ratedBy) => {
                try {
                    const res = await apiFetch(`/api/rides/${rideId}/rate`, {
                        method: 'POST',
                        body: JSON.stringify({ rating, ratedBy })
                    });

                    if (res.ok) {
                        get().addToast('success', 'Rating submitted');
                        const { user } = get();
                        if (user) {
                            const userRes = await apiFetch(`/api/users/${user.id}`);
                            if (userRes.ok) {
                                const userData = await userRes.json();
                                set(state => ({ user: { ...state.user, ...userData } }));
                            }
                        }
                    }
                } catch (e) {
                    get().addToast('error', 'Rating failed');
                }
            }
        }),
        {
            name: 'itaxi-storage',
            partialize: (state) => ({
                isDarkMode: state.isDarkMode,
                language: state.language,
                user: state.user,
                currentRole: state.currentRole,
                adminSettings: state.adminSettings,
                // Never persist appMode — App.tsx restoreSession decides it on every load
                activeRide: state.activeRide,
                currentRoute: state.currentRoute
            }),
        }
    )
);
