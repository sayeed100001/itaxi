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
import { ForgotPasswordPage } from './pages/Auth/ForgotPasswordPage';
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
    const adminSettings = useAppStore((state) => state.adminSettings);

    // Map actions
    const updateUserLocation = useAppStore((state) => state.updateUserLocation);
    const refreshDrivers = useAppStore((state) => state.refreshDrivers);
    const fetchInitialData = useAppStore((state) => state.fetchInitialData);

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

    // Sync User with Socket — only join room, never re-connect (App.tsx owns connect lifecycle)
    useEffect(() => {
        if (user?.id && socketService.getIsConnected()) {
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

        const restoreSession = async () => {
            const token = localStorage.getItem('token');

            if (!token) {
                if (!cancelled) {
                    useAppStore.getState().setAppMode('landing');
                    console.log('🔓 No token found, redirecting to landing');
                }
                return;
            }

            // Token exists — try to verify with retry logic
            let lastError: any = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                if (cancelled) return;
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
                        localStorage.setItem('token', token);
                        useAppStore.getState().setUser(userData.user);
                        // Always reset role to the user's actual role on session restore
                        useAppStore.getState().setRole(userData.user.role);
                        useAppStore.getState().setAppMode('app');
                        console.log('✅ Session restored for user:', userData.user.name);
                        return; // success — socket.connect() called once below in .then()
                    }

                    // 401 = token genuinely invalid/expired — do NOT retry
                    if (response.status === 401) {
                        if (cancelled) return;
                        console.log('❌ Token expired or invalid, clearing session');
                        localStorage.removeItem('token');
                        useAppStore.getState().setUser(null);
                        useAppStore.getState().setAppMode('landing');
                        return;
                    }

                    // 5xx or other server error — retry
                    lastError = new Error(`HTTP ${response.status}`);
                } catch (error: any) {
                    if (cancelled) return;
                    if (error?.name === 'AbortError') return;
                    lastError = error;
                    console.warn(`Session restore attempt ${attempt} failed:`, error?.message);
                }

                // Wait before retry (exponential backoff)
                if (attempt < 3 && !cancelled) {
                    await new Promise(r => setTimeout(r, attempt * 1000));
                }
            }

            // All retries failed — KEEP the token, show app from persisted state
            // DO NOT logout on network failure — user might just be offline
            if (!cancelled) {
                console.warn('Session verify failed after retries, using persisted state:', lastError?.message);
                const persistedUser = useAppStore.getState().user;
                if (persistedUser) {
                    // We have persisted user data — show app, token stays
                    useAppStore.getState().setAppMode('app');
                } else {
                    useAppStore.getState().setAppMode('landing');
                }
            }
        };

        restoreSession().then(() => {
            if (!cancelled) {
                fetchInitialData();
                // Connect socket once, after session is fully resolved
                socketService.disconnect();
                socketService.connect();
            }
        });

        // --- Geolocation Logic ---
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (cancelled) return;
                    const { latitude, longitude } = position.coords;
                    const newLocation = { lat: latitude, lng: longitude };
                    console.log("📍 GPS Location Found:", newLocation);
                    updateUserLocation(newLocation);
                    refreshDrivers();
                },
                (error) => {
                    if (cancelled) return;
                    console.warn("Geolocation error:", error.message);
                    refreshDrivers();
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
            );
        } else {
            refreshDrivers();
        }

        return () => {
            cancelled = true;
            try { abortController.abort(); } catch {}
            socketService.disconnect();
        };
    }, []);

    // 1. Landing Page Mode
    if (appMode === 'landing') {
        return <LandingPage />;
    }

    // 1.5 Forgot Password Mode
    if (appMode === 'forgot-password' as any) {
        return <ForgotPasswordPage />;
    }

    // 2. Auth Mode - Logic to show login if user is not set, or if explicitly in auth mode
    if (appMode === 'auth') {
        return <LoginPage />;
    }

    // 3. Authenticated App Portal
    const renderContent = () => {
        // Check maintenance mode and portal access from admin settings
        const portals = (adminSettings as any)?.portals;
        const maintenanceMode = portals?.maintenanceMode === true;
        const driverPortalEnabled = portals?.driverPortal !== false; // default true
        const riderPortalEnabled = portals?.riderPortal !== false; // default true

        if (maintenanceMode && user?.role !== 'admin') {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-8 text-center">
                    <div className="text-6xl mb-6">🔧</div>
                    <h1 className="text-3xl font-bold mb-3">سیستم در حال نگهداری است</h1>
                    <p className="text-zinc-400 text-lg">لطفاً بعداً دوباره تلاش کنید.</p>
                </div>
            );
        }

        if (currentRole === 'driver' && !driverPortalEnabled && user?.role !== 'admin') {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-8 text-center">
                    <div className="text-6xl mb-6">🚫</div>
                    <h1 className="text-3xl font-bold mb-3">پورتال رانندگان غیرفعال است</h1>
                    <p className="text-zinc-400">ادمین این پورتال را موقتاً غیرفعال کرده است.</p>
                </div>
            );
        }

        if (currentRole === 'rider' && !riderPortalEnabled && user?.role !== 'admin') {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-8 text-center">
                    <div className="text-6xl mb-6">🚫</div>
                    <h1 className="text-3xl font-bold mb-3">پورتال مسافران غیرفعال است</h1>
                    <p className="text-zinc-400">ادمین این پورتال را موقتاً غیرفعال کرده است.</p>
                </div>
            );
        }

        // --- Admin Role Special Routing ---
        if (currentRole === 'admin' && user?.role === 'admin') {
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
