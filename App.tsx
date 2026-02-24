import React, { useEffect } from 'react';
import { Layout } from './components/Layout/Layout';
import { RiderHome } from './pages/Rider/RiderHome';
import { DriverHome } from './pages/Driver/DriverHome';
import { DriverEarningsPage } from './pages/Driver/DriverEarningsPage';
import { DriverProfilePage } from './pages/Driver/DriverProfilePage';
import { DriverRatingsPage } from './pages/Driver/DriverRatingsPage';
import { DriverSettingsPage } from './pages/Driver/DriverSettingsPage';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { AdminSettings } from './pages/Admin/AdminSettings';
import { AdminDriversPage } from './pages/Admin/AdminDriversPage';
import { AdminFinancePage } from './pages/Admin/AdminFinancePage';
import { AdminAnalyticsPage } from './pages/Admin/AdminAnalyticsPage';
import { AdminWhatsAppPage } from './pages/Admin/AdminWhatsAppPage';
import { AdminDispatchPage } from './pages/Admin/AdminDispatchPage';
import { AdminReconcilePage } from './pages/Admin/AdminReconcilePage';
import { AdminPayoutsPage } from './pages/Admin/AdminPayoutsPage';
import { AdminCreditPurchasePage } from './pages/Admin/AdminCreditPurchasePage';
import { WalletPage } from './pages/Shared/WalletPage';
import { SettingsPage } from './pages/Shared/SettingsPage';
import { ActivityPage } from './pages/Shared/ActivityPage';
import { SupportPage } from './pages/Shared/SupportPage';
import { NotificationsPage } from './pages/Shared/NotificationsPage';
import { MessagesPage } from './pages/Shared/MessagesPage';
import { LandingPage } from './pages/Landing/LandingPage';
import { LoginPage } from './pages/Auth/LoginPage';
import { AdminLoginPage } from './pages/Auth/AdminLoginPage';
import { ToastContainer } from './components/ui/ToastContainer';
import { RatingModal } from './components/Ride/RatingModal';
import { ChatSheet } from './components/Chat/ChatSheet';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAppStore } from './store';
import { socketService } from './services/socket';

const App: React.FC = () => {
    // Select specific state slices to avoid re-rendering App on every store change
    const user = useAppStore((state) => state.user);
    const currentRole = useAppStore((state) => state.currentRole);
    const currentView = useAppStore((state) => state.currentView);
    const appMode = useAppStore((state) => state.appMode);
    const isDarkMode = useAppStore((state) => state.isDarkMode);
    const language = useAppStore((state) => state.language);
    const chatState = useAppStore((state) => state.chatState);
    const closeChat = useAppStore((state) => state.closeChat);
    const activeRide = useAppStore((state) => state.activeRide);
    const startRide = useAppStore((state) => state.startRide);
    const updateRideStatus = useAppStore((state) => state.updateRideStatus);
    const completeRide = useAppStore((state) => state.completeRide);
    const logout = useAppStore((state) => state.logout);
    
    // Map actions
    const updateUserLocation = useAppStore((state) => state.updateUserLocation);
    const addToast = useAppStore((state) => state.addToast);

    // Sync Dark Mode Class
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Sync Language & Direction
    useEffect(() => {
        if (language === 'fa') {
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'fa';
            document.body.classList.add('font-fa');
            document.body.classList.remove('font-sans');
        } else {
            document.documentElement.dir = 'ltr';
            document.documentElement.lang = 'en';
            document.body.classList.add('font-sans');
            document.body.classList.remove('font-fa');
        }
    }, [language]);

    // Validate stored token on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (user && !token) {
            // User in store but no token - clear session
            logout();
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && user) {
            socketService.connect(token);
        }

        // --- Geolocation Logic ---
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const newLocation = { lat: latitude, lng: longitude };
                    
                    console.log("📍 GPS Location Found:", newLocation);
                    
                    // Update user location in store
                    updateUserLocation(newLocation);
                    
                    // Drivers will be fetched from backend via socket
                    
                    addToast('success', 'Location updated to GPS coordinates');
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    addToast('warning', 'Could not fetch GPS. Using default location.');
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } else {
            addToast('error', 'Geolocation is not supported by this browser.');
        }

        return () => {
            socketService.disconnect();
        };
    }, [user]);

    useEffect(() => {
        if (!user || currentRole !== 'RIDER') return;

        const handleAccepted = (trip: any) => {
            if (!activeRide || activeRide.id !== trip?.id) return;
            startRide({
                ...activeRide,
                status: 'accepted',
                driverId: trip.driverId || activeRide.driverId,
            });
        };

        const handleArrived = (trip: any) => {
            if (!activeRide || activeRide.id !== trip?.id) return;
            updateRideStatus('arrived');
        };

        const handleStarted = (trip: any) => {
            if (!activeRide || activeRide.id !== trip?.id) return;
            updateRideStatus('in_progress');
        };

        const handleCompleted = (trip: any) => {
            if (!activeRide || activeRide.id !== trip?.id) return;
            completeRide();
        };

        socketService.on('trip:accepted', handleAccepted);
        socketService.on('trip:driver_arrived', handleArrived);
        socketService.on('trip:started', handleStarted);
        socketService.on('trip:completed', handleCompleted);

        return () => {
            socketService.off('trip:accepted', handleAccepted);
            socketService.off('trip:driver_arrived', handleArrived);
            socketService.off('trip:started', handleStarted);
            socketService.off('trip:completed', handleCompleted);
        };
    }, [user, currentRole, activeRide, startRide, updateRideStatus, completeRide]);

    // 1. Landing Page Mode - show for unauthenticated users
    if (appMode === 'landing' && !user) {
        return <LandingPage />;
    }

    // 2. Auth Mode - Logic to show login if user is not set, or if explicitly in auth mode
    if (!user) {
        // Check URL for admin login
        if (window.location.pathname === '/admin' || window.location.hash === '#/admin') {
            return <AdminLoginPage />;
        }
        // Show login page if in auth mode, otherwise show landing
        if (appMode === 'auth') {
            return <LoginPage />;
        }
        // Default: show landing page for unauthenticated users
        return <LandingPage />;
    }

    // 3. Authenticated App Portal
    const renderContent = () => {
        // --- Admin Role Special Routing ---
        if (currentRole === 'ADMIN') {
            return (
                <ProtectedRoute allowedRoles={['ADMIN']}>
                    {currentView === 'drivers' && <AdminDriversPage />}
                    {currentView === 'finance' && <AdminFinancePage />}
                    {currentView === 'analytics' && <AdminAnalyticsPage />}
                    {currentView === 'whatsapp' && <AdminWhatsAppPage />}
                    {currentView === 'dispatch' && <AdminDispatchPage />}
                    {currentView === 'reconcile' && <AdminReconcilePage />}
                    {currentView === 'payouts' && <AdminPayoutsPage />}
                    {currentView === 'credits' && <AdminCreditPurchasePage />}
                    {(currentView === 'settings' || currentView === 'profile') && <SettingsPage />}
                    {currentView === 'admin_settings' && <AdminSettings />}
                    {currentView === 'messages' && <MessagesPage />}
                    {!['drivers', 'finance', 'analytics', 'whatsapp', 'dispatch', 'reconcile', 'payouts', 'credits', 'settings', 'profile', 'admin_settings', 'messages'].includes(currentView) && <AdminDashboard />}
                </ProtectedRoute>
            );
        }

        // --- Driver Specific Views ---
        if (currentRole === 'DRIVER') {
            if (currentView === 'drivers') return <DriverEarningsPage />;
            if (currentView === 'wallet' || currentView === 'finance') return <WalletPage />;
            if (currentView === 'profile') return <DriverProfilePage />;
            if (currentView === 'settings') return <SettingsPage />;
            if (currentView === 'analytics') return <DriverRatingsPage />;
            if (currentView === 'activity' || currentView === 'trips') return <ActivityPage />;
            if (currentView === 'support') return <SupportPage />;
            if (currentView === 'notifications') return <NotificationsPage />;
            if (currentView === 'messages') return <MessagesPage />;
            return (
                <ProtectedRoute allowedRoles={['DRIVER']}>
                    <DriverHome />
                </ProtectedRoute>
            );
        }

        // --- Shared Views (for Rider/Admin) ---
        if (currentView === 'wallet' || currentView === 'finance') return <WalletPage />;
        if (currentView === 'profile' || currentView === 'settings') return <SettingsPage />;
        if (currentView === 'activity' || currentView === 'trips') return <ActivityPage />;
        if (currentView === 'support') return <SupportPage />;
        if (currentView === 'notifications') return <NotificationsPage />;
        if (currentView === 'messages') return <MessagesPage />;
        
        // Default: Rider
        return (
            <ProtectedRoute allowedRoles={['RIDER', 'ADMIN']}>
                <RiderHome />
            </ProtectedRoute>
        );
    };

    return (
        <>
            <ToastContainer />
            <RatingModal />
            <ChatSheet 
                isOpen={chatState.isOpen} 
                onClose={closeChat} 
                recipientName={chatState.recipientName} 
                recipientRole={chatState.recipientRole} 
            />
            <Layout>
                {renderContent()}
            </Layout>
        </>
    );
};

export default App;
