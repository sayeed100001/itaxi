import React, { useEffect, useMemo, useState } from 'react';
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
    const adminSettings = useAppStore((state) => state.adminSettings);

    // Keep track of visited views to prevent remounting
    const [visitedViews, setVisitedViews] = useState<Set<string>>(new Set(['home']));

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

    // Sync User with Socket
    useEffect(() => {
        if (user?.id && socketService.getIsConnected()) {
            socketService.joinRoom(user.id);
        }
    }, [user?.id]);

    // Global 401 handler
    useEffect(() => {
        const handler = () => {
            try { socketService.disconnect(); } catch {}
            try { localStorage.removeItem('token'); } catch {}
            try { useAppStore.getState().logout(); } catch {}
        };

        window.addEventListener('itaxi:unauthorized', handler as any);
        return () => window.removeEventListener('itaxi:unauthorized', handler as any);
    }, []);

    // Track visited views
    useEffect(() => {
        const viewId = `${currentRole}-${currentView}`;
        setVisitedViews(prev => new Set([...prev, viewId]));
    }, [currentRole, currentView]);

    // Session restore - only run once on mount
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
                    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
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
                        useAppStore.getState().setRole(userData.user.role);
                        useAppStore.getState().setAppMode('app');
                        console.log('✅ Session restored for user:', userData.user.name);
                        return;
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
            if (!cancelled) {
                console.warn('Session verify failed after retries, using persisted state:', lastError?.message);
                const persistedUser = useAppStore.getState().user;
                if (persistedUser) {
                    useAppStore.getState().setAppMode('app');
                } else {
                    useAppStore.getState().setAppMode('landing');
                }
            }
        };

        restoreSession().then(() => {
            if (!cancelled) {
                fetchInitialData();
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
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ALL HOOKS MUST BE CALLED BEFORE THIS POINT - NO EARLY RETURNS ABOVE

    // Build all views - ALWAYS called, not conditional
    const allViews = useMemo(() => {
        const portals = (adminSettings as any)?.portals;
        const maintenanceMode = portals?.maintenanceMode === true;
        const driverPortalEnabled = portals?.driverPortal !== false;
        const riderPortalEnabled = portals?.riderPortal !== false;

        const views: { [key: string]: JSX.Element } = {};

        // Maintenance mode
        if (maintenanceMode && user?.role !== 'admin') {
            views['maintenance'] = (
                <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-8 text-center">
                    <div className="text-6xl mb-6">🔧</div>
                    <h1 className="text-3xl font-bold mb-3">سیستم در حال نگهداری است</h1>
                    <p className="text-zinc-400 text-lg">لطفاً بعداً دوباره تلاش کنید.</p>
                </div>
            );
            return views;
        }

        // Portal disabled checks
        if (currentRole === 'driver' && !driverPortalEnabled && user?.role !== 'admin') {
            views['driver-disabled'] = (
                <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-8 text-center">
                    <div className="text-6xl mb-6">🚫</div>
                    <h1 className="text-3xl font-bold mb-3">پورتال رانندهگان غیرفعال است</h1>
                    <p className="text-zinc-400">ادمین این پورتال را موقتاً غیرفعال کرده است.</p>
                </div>
            );
            return views;
        }

        if (currentRole === 'rider' && !riderPortalEnabled && user?.role !== 'admin') {
            views['rider-disabled'] = (
                <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-8 text-center">
                    <div className="text-6xl mb-6">🚫</div>
                    <h1 className="text-3xl font-bold mb-3">پورتال مسافران غیرفعال است</h1>
                    <p className="text-zinc-400">ادمین این پورتال را موقتاً غیرفعال کرده است.</p>
                </div>
            );
            return views;
        }

        // Admin views
        if (currentRole === 'admin' && user?.role === 'admin') {
            views['admin-home'] = <AdminDashboard />;
            views['admin-drivers'] = <AdminDriversPage />;
            views['admin-finance'] = <AdminFinancePage />;
            views['admin-analytics'] = <AdminAnalyticsPage />;
            views['admin-trips'] = <AdminRidesPage />;
            views['admin-activity'] = <AdminUsersPage />;
            views['admin-settings'] = <SettingsPage />;
            views['admin-profile'] = <SettingsPage />;
            views['admin-admin_settings'] = <AdminSettings />;
            views['admin-messages'] = <MessagesPage />;
        }

        // Shared views
        views[`${currentRole}-wallet`] = <WalletPage />;
        views[`${currentRole}-finance`] = <WalletPage />;
        views[`${currentRole}-profile`] = <SettingsPage />;
        views[`${currentRole}-settings`] = <SettingsPage />;
        views[`${currentRole}-activity`] = <ActivityPage />;
        views[`${currentRole}-trips`] = <ActivityPage />;
        views[`${currentRole}-drivers`] = <ActivityPage />;
        views[`${currentRole}-support`] = <SupportPage />;
        views[`${currentRole}-notifications`] = <NotificationsPage />;
        views[`${currentRole}-messages`] = <MessagesPage />;

        // Role specific home
        views['driver-home'] = <DriverHome />;
        views['rider-home'] = <RiderHome />;

        return views;
    }, [currentRole, user, adminSettings]);

    const currentViewKey = useMemo(() => {
        const portals = (adminSettings as any)?.portals;
        const maintenanceMode = portals?.maintenanceMode === true;
        const driverPortalEnabled = portals?.driverPortal !== false;
        const riderPortalEnabled = portals?.riderPortal !== false;

        if (maintenanceMode && user?.role !== 'admin') return 'maintenance';
        if (currentRole === 'driver' && !driverPortalEnabled && user?.role !== 'admin') return 'driver-disabled';
        if (currentRole === 'rider' && !riderPortalEnabled && user?.role !== 'admin') return 'rider-disabled';

        return `${currentRole}-${currentView}`;
    }, [currentRole, currentView, user, adminSettings]);

    // NOW we can do early returns - all hooks have been called
    if (appMode === 'landing') {
        return <LandingPage />;
    }

    if (appMode === 'auth') {
        return <LoginPage />;
    }

    // App mode - render authenticated views
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
                {Object.entries(allViews).map(([key, view]) => (
                    <div
                        key={key}
                        style={{
                            display: key === currentViewKey ? 'block' : 'none',
                            width: '100%',
                            height: '100%'
                        }}
                    >
                        {visitedViews.has(key) || key === currentViewKey ? view : null}
                    </div>
                ))}
            </Layout>
        </ErrorBoundary>
    );
};

export default App;
