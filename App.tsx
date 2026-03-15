import React, { useEffect } from 'react';
import { Layout } from './components/Layout/Layout';
import { RiderHome } from './pages/Rider/RiderHome';
import { DriverHome } from './pages/Driver/DriverHome';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { AdminSettings } from './pages/Admin/AdminSettings';
import { AdminDriversPage } from './pages/Admin/AdminDriversPage';
import { AdminFinancePage } from './pages/Admin/AdminFinancePage';
import { AdminAnalyticsPage } from './pages/Admin/AdminAnalyticsPage';
import { AdminRidesPage } from './pages/Admin/AdminRidesPage';
import { AdminUsersPage } from './pages/Admin/AdminUsersPage';
import { WalletPage } from './pages/Shared/WalletPage';
import { SettingsPage } from './pages/Shared/SettingsPage';
import { ActivityPage } from './pages/Shared/ActivityPage';
import { SupportPage } from './pages/Shared/SupportPage';
import { NotificationsPage } from './pages/Shared/NotificationsPage';
import { MessagesPage } from './pages/Shared/MessagesPage';
import { LandingPage } from './pages/Landing/LandingPage';
import { LoginPage } from './pages/Auth/LoginPage';
import { ToastContainer } from './components/ui/ToastContainer';
import { RatingModal } from './components/Ride/RatingModal';
import { ChatSheet } from './components/Chat/ChatSheet';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppStore } from './store';
import { socketService } from './services/socketService';
import { API_BASE_URL } from './src/config/api';

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

    // Map actions
    const updateUserLocation = useAppStore((state) => state.updateUserLocation);
    const refreshDrivers = useAppStore((state) => state.refreshDrivers);
    const fetchInitialData = useAppStore((state) => state.fetchInitialData);
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

    // Sync User with Socket
    useEffect(() => {
        if (user?.id) {
            socketService.joinRoom(user.id);
        }
    }, [user?.id]);

    // Global 401 handler (triggered by `apiFetch` when a tokened request gets 401).
    useEffect(() => {
        const handler = () => {
            try { socketService.disconnect(); } catch {}
            try { localStorage.removeItem('token'); } catch {}
            // Use store action to reset app state.
            try { useAppStore.getState().logout(); } catch {}
        };

        window.addEventListener('itaxi:unauthorized', handler as any);
        return () => window.removeEventListener('itaxi:unauthorized', handler as any);
    }, []);

    useEffect(() => {
        const abortController = new AbortController();
        let cancelled = false;

        // Check for existing token and restore user session
        const restoreSession = async () => {
            const token = localStorage.getItem('token');

            if (token) {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        signal: abortController.signal
                    });

                    if (cancelled) return;

                    if (response.ok) {
                        const userData = await response.json();
                        if (cancelled) return;
                        // Keep token in localStorage (already there, just ensure it stays)
                        localStorage.setItem('token', token);
                        useAppStore.getState().setUser(userData.user);
                        useAppStore.getState().setRole(userData.user.role);
                        useAppStore.getState().setAppMode('app');
                        // Reconnect socket with valid token
                        socketService.disconnect();
                        socketService.connect();
                        console.log('✅ Session restored for user:', userData.user.name);
                    } else {
                        const errorData = await response.json();
                        if (cancelled) return;
                        console.log('❌ Token verification failed:', errorData.error);
                        // Invalid or expired token, remove it
                        localStorage.removeItem('token');
                        useAppStore.getState().setUser(null);
                        useAppStore.getState().setAppMode('landing');
                    }
                } catch (error) {
                    if (cancelled) return;
                    // Abort is expected during React StrictMode mount/unmount in DEV.
                    if ((error as any)?.name === 'AbortError') return;
                    console.error('Session restore failed:', error);
                    localStorage.removeItem('token');
                    useAppStore.getState().setUser(null);
                    useAppStore.getState().setAppMode('landing');
                }
            } else {
                if (cancelled) return;
                // No token, ensure we're in landing mode
                useAppStore.getState().setUser(null);
                useAppStore.getState().setAppMode('landing');
                console.log('🔓 No token found, redirecting to landing');
            }
        };

        // First restore session (which will reconnect socket with token if valid),
        // then fetch initial data. Socket connect happens inside restoreSession on success.
        restoreSession().then(() => {
            if (!cancelled) fetchInitialData();
        });

        // Initial socket connect attempt (will reconnect with token after restoreSession if needed)
        socketService.connect();

        // --- Geolocation Logic ---
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (cancelled) return;
                    const { latitude, longitude } = position.coords;
                    const newLocation = { lat: latitude, lng: longitude };

                    console.log("📍 GPS Location Found:", newLocation);

                    // Update user location in store
                    updateUserLocation(newLocation);

                    // Refresh drivers from real API
                    refreshDrivers();

                    addToast('success', 'Location updated to GPS coordinates');
                },
                (error) => {
                    if (cancelled) return;
                    console.error("Geolocation error:", error);
                    addToast('warning', 'Could not fetch GPS. Using default location.');
                    refreshDrivers(); // Still try to fetch drivers
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } else {
            if (cancelled) return;
            addToast('error', 'Geolocation is not supported by this browser.');
            refreshDrivers();
        }

        return () => {
            cancelled = true;
            try {
                abortController.abort();
            } catch {}
            socketService.disconnect();
        };
    }, []);

    // 1. Landing Page Mode
    if (appMode === 'landing') {
        return <LandingPage />;
    }

    // 2. Auth Mode - Logic to show login if user is not set, or if explicitly in auth mode
    if (appMode === 'auth') {
        return <LoginPage />;
    }

    // 3. Authenticated App Portal
    const renderContent = () => {
        // --- Admin Role Special Routing ---
        if (currentRole === 'admin') {
            if (currentView === 'drivers') return <AdminDriversPage />;
            if (currentView === 'finance') return <AdminFinancePage />;
            if (currentView === 'analytics') return <AdminAnalyticsPage />;
            if (currentView === 'trips') return <AdminRidesPage />;
            if (currentView === 'activity') return <AdminUsersPage />;
            if (currentView === 'settings' || currentView === 'profile') return <SettingsPage />;
            if (currentView === 'admin_settings') return <AdminSettings />;
            if (currentView === 'messages') return <MessagesPage />;
            // Default admin view: dashboard
            return <AdminDashboard />;
        }

        // --- Shared Views ---
        if (currentView === 'wallet' || currentView === 'finance') return <WalletPage />;
        if (currentView === 'profile' || currentView === 'settings') return <SettingsPage />;
        if (currentView === 'activity' || currentView === 'trips' || currentView === 'drivers') return <ActivityPage />;
        if (currentView === 'support') return <SupportPage />;
        if (currentView === 'notifications') return <NotificationsPage />;
        if (currentView === 'messages') return <MessagesPage />;

        // --- Role Specific Home ---
        switch (currentRole) {
            case 'driver':
                return <DriverHome />;
            case 'rider':
            default:
                return <RiderHome />;
        }
    };

    return (
        <ErrorBoundary>
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
        </ErrorBoundary>
    );
};

export default App;
