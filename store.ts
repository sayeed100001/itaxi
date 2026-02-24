
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Ride, UserRole, AdminSettings, RouteData, Location, DriverMarker, Hotel, Toast, Transaction, AppNotification, ChatState, WithdrawalRequest } from './types';

export type AppMode = 'landing' | 'auth' | 'app';
export type AppView =
    | 'home'
    | 'trips'
    | 'wallet'
    | 'messages'
    | 'profile'
    | 'settings'
    | 'earnings'
    | 'drivers'
    | 'analytics'
    | 'notifications'
    | 'finance'
    | 'admin_settings'
    | 'activity'
    | 'support'
    | 'dispatch'
    | 'whatsapp'
    | 'payouts'
    | 'reconcile'
    | 'credits';
export type Language = 'en' | 'fa';

interface AppState {
    appMode: AppMode;
    user: User | null;
    currentRole: UserRole;
    activeRide: Ride | null;
    pastTrips: Ride[];
    transactions: Transaction[];
    withdrawalRequests: WithdrawalRequest[];
    notifications: AppNotification[];
    isDarkMode: boolean;
    language: Language;
    toasts: Toast[];
    currentView: AppView;
    chatState: ChatState;
    pendingRatingRide: Ride | null;
    
    // Admin & Config
    adminSettings: AdminSettings;
    
    // Map & Location Data
    userLocation: Location;
    drivers: DriverMarker[];
    hotels: Hotel[];
    currentRoute: RouteData | null;
    
    // Actions
    setAppMode: (mode: AppMode) => void;
    setUser: (user: User | null) => void;
    updateUserProfile: (data: Partial<User>) => void;
    setRole: (role: UserRole) => void;
    setView: (view: AppView) => void;
    startRide: (ride: Ride | null) => void;
    updateRideStatus: (status: Ride['status']) => void;
    completeRide: () => void;
    setPastTrips: (trips: Ride[]) => void; 
    toggleDarkMode: () => void;
    setLanguage: (lang: Language) => void;
    logout: () => void;
    
    // Chat Actions
    openChat: (recipientId: string, name: string, role: string, tripId?: string) => void;
    closeChat: () => void;
    setPendingRatingRide: (ride: Ride | null) => void;

    // Data Actions
    addNotification: (notification: AppNotification) => void;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    addTransaction: (tx: Transaction) => void;
    processWithdrawal: (id: string, status: 'approved' | 'rejected') => void;
    
    // Map Actions
    updateUserLocation: (loc: Location) => void;
    updateDrivers: (drivers: DriverMarker[]) => void;
    updateDriver: (id: string, data: Partial<DriverMarker>) => void;
    registerDriver: (driver: DriverMarker) => void; 
    // generateLocalDrivers removed - use real drivers from backend 
    setRoute: (route: RouteData | null) => void;
    
    // Admin Actions
    updateAdminSettings: (settings: Partial<AdminSettings>) => void;
    addHotel: (hotel: Hotel) => void;
    removeHotel: (id: string) => void;
    
    // Toast Actions
    addToast: (type: Toast['type'], message: string) => void;
    removeToast: (id: string) => void;
}

const DEFAULT_LOCATION = { lat: 34.5333, lng: 69.1667 };

const INITIAL_HOTELS: Hotel[] = [];

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
    routingProvider: 'ors', 
    mapProvider: 'osm',
    apiKeys: {
        ors: '', // Configured on backend only
        mapbox: '',
        google: ''
    },
    pricing: {
        minFare: 50,
        commissionRate: 15,
        cancellationFee: 20,
        intercityMultiplier: 1.5
    },
    services: [
        { id: 'eco', name: 'iTaxi Eco', baseFare: 40, perKm: 15, perMin: 2, minFare: 50, commission: 15, icon: 'Car' },
        { id: 'plus', name: 'iTaxi Plus', baseFare: 60, perKm: 25, perMin: 4, minFare: 80, commission: 20, icon: 'Car' },
        { id: 'lux', name: 'iTaxi Lux', baseFare: 100, perKm: 40, perMin: 8, minFare: 150, commission: 25, icon: 'Car' }
    ],
    system: {
        defaultCenter: DEFAULT_LOCATION,
        driverUpdateInterval: 1000,
        enableManualFare: true,
        radiusLimit: 10,
        dispatchTimeout: 20
    },
    hotelsModule: {
        enabled: true,
        commission: 5
    }
};

const INITIAL_TRANSACTIONS: Transaction[] = [];

const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [];

const INITIAL_NOTIFICATIONS: AppNotification[] = [];

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            appMode: 'landing',
            user: null, 
            currentRole: null,
            activeRide: null,
            pastTrips: [],
            transactions: INITIAL_TRANSACTIONS,
            withdrawalRequests: INITIAL_WITHDRAWALS,
            notifications: INITIAL_NOTIFICATIONS,
            isDarkMode: true,
            language: 'en',
            toasts: [],
            currentView: 'home',
            chatState: { 
                isOpen: false, 
                tripId: undefined,
                recipientId: '', 
                recipientName: '', 
                recipientRole: ''
            },
            pendingRatingRide: null,
            
            adminSettings: DEFAULT_ADMIN_SETTINGS,
            
            userLocation: DEFAULT_LOCATION,
            drivers: [],
            hotels: INITIAL_HOTELS,
            currentRoute: null,

            setAppMode: (mode) => set({ appMode: mode }),
            setUser: (user) => set({ user, appMode: 'app' }),
            updateUserProfile: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
            setRole: (role) => set({ currentRole: role, currentView: 'home' }), 
            setView: (view) => set({ currentView: view }),
            
            startRide: (ride) => set((state) => ({
                activeRide: ride,
                currentRoute: ride?.route || state.currentRoute
            })),
            setPastTrips: (trips) => set({ pastTrips: trips }),
            
            updateRideStatus: (status) => {
                const state = get();
                if (state.activeRide) {
                    let notifTitle = '';
                    let notifMsg = '';
                    
                    if (status === 'accepted') {
                        notifTitle = 'Driver Found';
                        notifMsg = 'A driver has accepted your request.';
                    } else if (status === 'arrived') {
                        notifTitle = 'Driver Arrived';
                        notifMsg = 'Your driver is waiting at the pickup location.';
                    } else if (status === 'in_progress') {
                        notifTitle = 'Trip Started';
                        notifMsg = 'You are on your way to the destination.';
                    } else if (status === 'completed') {
                        notifTitle = 'Trip Completed';
                        notifMsg = 'You have arrived. Thank you for riding with iTaxi.';
                    }

                    if (notifTitle) {
                        get().addNotification({
                            id: `n_${Date.now()}`,
                            type: status === 'completed' ? 'success' : 'system',
                            title: notifTitle,
                            message: notifMsg,
                            timestamp: Date.now(),
                            read: false
                        });
                    }

                    set({ activeRide: { ...state.activeRide, status } });
                }
            },

            completeRide: () => {
                const { activeRide, adminSettings, addNotification } = get();
                if (!activeRide) return;

                const fare = activeRide.fare;
                const commission = (fare * adminSettings.pricing.commissionRate) / 100;
                const driverEarnings = fare - commission;
                
                const newTx: Transaction = {
                    id: `tx_${Date.now()}`,
                    amount: get().currentRole === 'DRIVER' ? driverEarnings : fare,
                    type: get().currentRole === 'DRIVER' ? 'credit' : 'debit',
                    date: Date.now(),
                    description: `Trip to ${activeRide.destination}`,
                    status: 'completed'
                };

                const completedRide: Ride = { ...activeRide, status: 'completed' };
                
                addNotification({
                    id: `n_end_${Date.now()}`,
                    type: 'success',
                    title: 'Payment Successful',
                    message: `Trip fare of ؋${fare} has been processed.`,
                    timestamp: Date.now(),
                    read: false
                });

                set((state) => ({
                    pastTrips: [completedRide, ...state.pastTrips],
                    activeRide: null,
                    pendingRatingRide: completedRide,
                    currentRoute: null,
                    transactions: [newTx, ...state.transactions],
                    user: state.user ? {
                        ...state.user,
                        balance: (state.user.balance || 0) + (newTx.type === 'credit' ? newTx.amount : -newTx.amount),
                        totalTrips: (state.user.totalTrips || 0) + 1
                    } : null
                }));
            },
            
            toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
            setLanguage: (lang) => set({ language: lang }),
            logout: () => set({ user: null, activeRide: null, pendingRatingRide: null, appMode: 'landing', currentRole: null, currentView: 'home', currentRoute: null }),

            openChat: (recipientId, name, role, tripId) => set((state) => ({ 
                chatState: { ...state.chatState, isOpen: true, tripId, recipientId, recipientName: name, recipientRole: role } 
            })),
            closeChat: () => set((state) => ({ chatState: { ...state.chatState, isOpen: false, tripId: undefined } })),
            setPendingRatingRide: (ride) => set({ pendingRatingRide: ride }),

            addNotification: (notification) => set((state) => ({ notifications: [notification, ...state.notifications] })),
            markNotificationRead: (id) => set(state => ({
                notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
            })),

            markAllNotificationsRead: () => set(state => ({
                notifications: state.notifications.map(n => ({ ...n, read: true }))
            })),
            
            addTransaction: (tx) => set((state) => {
                const newBalance = (state.user?.balance || 0) + (tx.type === 'credit' ? tx.amount : -tx.amount);
                return {
                    transactions: [tx, ...state.transactions],
                    user: state.user ? { ...state.user, balance: newBalance } : null
                };
            }),
            
            processWithdrawal: (id, status) => set((state) => {
                const req = state.withdrawalRequests.find(w => w.id === id);
                if (!req) return {};
                
                const updatedRequests = state.withdrawalRequests.map(w => 
                    w.id === id ? { ...w, status, processedDate: Date.now() } : w
                );

                // If approved, create a transaction record
                let newTransactions = state.transactions;
                if (status === 'approved') {
                    const tx: Transaction = {
                        id: `tx_payout_${Date.now()}`,
                        amount: req.amount,
                        type: 'debit',
                        date: Date.now(),
                        description: `Payout to ${req.driverName}`,
                        status: 'completed'
                    };
                    newTransactions = [tx, ...state.transactions];
                }

                return { withdrawalRequests: updatedRequests, transactions: newTransactions };
            }),

            updateUserLocation: (loc) => set({ userLocation: loc }),
            
            updateDrivers: (drivers) => set({ drivers }),

            updateDriver: (id, data) => set((state) => ({
                drivers: state.drivers.map(d => d.id === id ? { ...d, ...data } : d)
            })),
            
            registerDriver: (driver) => set((state) => {
                const filtered = state.drivers.filter(d => d.id !== driver.id);
                return { drivers: [...filtered, driver] };
            }),

            // generateLocalDrivers removed - drivers come from backend via socket

            setRoute: (route) => set({ currentRoute: route }),

            updateAdminSettings: (newSettings) => set((state) => ({
                adminSettings: { ...state.adminSettings, ...newSettings }
            })),

            addHotel: (hotel) => set((state) => ({ hotels: [...state.hotels, hotel] })),
            removeHotel: (id) => set((state) => ({ hotels: state.hotels.filter(h => h.id !== id) })),

            addToast: (type, message) => {
                const id = Math.random().toString(36).substring(7);
                set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
                setTimeout(() => get().removeToast(id), 4000);
            },
            removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
        }),
        {
            name: 'itaxi-storage',
            partialize: (state) => ({ 
                isDarkMode: state.isDarkMode, 
                language: state.language,
                adminSettings: state.adminSettings,
                user: state.user,
                currentRole: state.currentRole,
                appMode: state.appMode,
                hotels: state.hotels,
                pastTrips: state.pastTrips,
                transactions: state.transactions,
                withdrawalRequests: state.withdrawalRequests,
                notifications: state.notifications,
                chatState: { ...state.chatState, isOpen: false, tripId: undefined } // Reset open state on reload, keep messages
            }),
        }
    )
);
