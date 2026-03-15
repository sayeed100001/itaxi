import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore, AppView } from '../../store';
import {
    Home, Map, Wallet, User, MessageCircle, List,
    Settings, Users, BarChart3, ShieldCheck, MoreHorizontal, Sliders, Car
} from 'lucide-react';
import { useI18n } from '../../services/useI18n';

export const BottomTabNav: React.FC = () => {
    const currentRole = useAppStore((state) => state.currentRole);
    const user = useAppStore((state) => state.user);
    const currentView = useAppStore((state) => state.currentView);
    const setView = useAppStore((state) => state.setView);
    const isDarkMode = useAppStore((state) => state.isDarkMode);
    const { t } = useI18n();

    const [adminMoreOpen, setAdminMoreOpen] = useState(false);

    useEffect(() => {
        // Close any open overlays when role/view changes.
        setAdminMoreOpen(false);
    }, [currentRole, currentView]);

    const adminMoreItems = useMemo(() => ([
        {
            id: 'kyc',
            label: t.bottom_nav.admin_tools.kyc,
            desc: t.bottom_nav.admin_tools.kyc_desc,
            icon: ShieldCheck,
            onSelect: () => {
                try {
                    window.sessionStorage?.setItem('itaxi:adminDriversTab', 'kyc');
                } catch {}
                setAdminMoreOpen(false);
                setView('drivers');
            }
        },
        { id: 'trips', label: t.bottom_nav.admin_tools.rides, desc: t.bottom_nav.admin_tools.rides_desc, icon: Car, view: 'trips' as AppView },
        { id: 'activity', label: t.bottom_nav.admin_tools.users, desc: t.bottom_nav.admin_tools.users_desc, icon: Users, view: 'activity' as AppView },
        { id: 'analytics', label: t.bottom_nav.admin_tools.analytics, desc: t.bottom_nav.admin_tools.analytics_desc, icon: BarChart3, view: 'analytics' as AppView },
        { id: 'messages', label: t.bottom_nav.admin_tools.messages, desc: t.bottom_nav.admin_tools.messages_desc, icon: MessageCircle, view: 'messages' as AppView },
        { id: 'admin_settings', label: t.bottom_nav.admin_tools.system, desc: t.bottom_nav.admin_tools.system_desc, icon: Sliders, view: 'admin_settings' as AppView },
        { id: 'settings', label: t.bottom_nav.admin_tools.settings, desc: t.bottom_nav.admin_tools.settings_desc, icon: Settings, view: 'settings' as AppView },
    ]), [setView, t.bottom_nav.admin_tools]);

    const getTabs = () => {
        if (currentRole === 'driver') {
            return [
                { id: 'home', icon: Map, label: t.bottom_nav.driver.drive, view: 'home' },
                { id: 'activity', icon: List, label: t.bottom_nav.driver.trips, view: 'activity' },
                { id: 'wallet', icon: Wallet, label: t.bottom_nav.driver.earnings, view: 'wallet' },
                { id: 'messages', icon: MessageCircle, label: t.bottom_nav.driver.chat, view: 'messages' },
                { id: 'profile', icon: User, label: t.bottom_nav.driver.profile, view: 'profile' },
            ];
        }

        if (currentRole === 'admin' && user?.role === 'admin') {
            return [
                { id: 'home', icon: BarChart3, label: t.bottom_nav.admin.dashboard, view: 'home' },
                { id: 'drivers', icon: Users, label: t.bottom_nav.admin.drivers, view: 'drivers' },
                { id: 'trips', icon: Car, label: t.bottom_nav.admin.rides, view: 'trips' },
                { id: 'finance', icon: Wallet, label: t.bottom_nav.admin.finance, view: 'finance' },
                { id: 'more', icon: MoreHorizontal, label: t.bottom_nav.admin.more, action: () => setAdminMoreOpen(true) },
            ];
        }

        // Rider (default)
        return [
            { id: 'home', icon: Home, label: t.bottom_nav.rider.home, view: 'home' },
            { id: 'activity', icon: List, label: t.bottom_nav.rider.trips, view: 'activity' },
            { id: 'messages', icon: MessageCircle, label: t.bottom_nav.rider.chat, view: 'messages' },
            { id: 'wallet', icon: Wallet, label: t.bottom_nav.rider.wallet, view: 'wallet' },
            { id: 'profile', icon: User, label: t.bottom_nav.rider.profile, view: 'profile' },
        ];
    };

    const tabs = getTabs() as Array<{ id: string; icon: any; label: string; view?: string; badge?: number; action?: () => void }>;

    return (
        <>
            {/* Admin "More" Sheet */}
            {currentRole === 'admin' && user?.role === 'admin' && adminMoreOpen && (
                <div className="lg:hidden fixed inset-0 z-[60]">
                    <button
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setAdminMoreOpen(false)}
                        aria-label={t.common.close}
                    />

                    <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white/96 dark:bg-zinc-950/96 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:ring-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                        <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-4"></div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-black text-zinc-900 dark:text-white">{t.bottom_nav.admin_tools.title}</div>
                            <button
                                onClick={() => setAdminMoreOpen(false)}
                                className="text-xs font-bold text-zinc-500 dark:text-zinc-400"
                            >
                              {t.bottom_nav.admin_tools.close}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {adminMoreItems.map((item: any) => {
                                const Icon = item.icon as any;
                                const isActive = item.view ? currentView === item.view : false;

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (item.onSelect) return item.onSelect();
                                            setAdminMoreOpen(false);
                                            setView(item.view);
                                        }}
                                        className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors text-left ${isActive
                                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20'
                                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                                            }`}
                                    >
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
                                            <Icon size={18} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-xs font-bold text-zinc-900 dark:text-white truncate">{item.label}</span>
                                            <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug line-clamp-2">{item.desc}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <nav
                className={`lg:hidden fixed bottom-0 left-0 right-0 z-[55] border-t ${isDarkMode
                    ? 'bg-zinc-950/95 border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.55)]'
                    : 'bg-white/95 border-black/5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]'
                    }`}
                style={{
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
                }}
            >
                <div className="flex items-stretch h-16">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = tab.view
                            ? currentView === tab.view
                            : (tab.id === 'more' ? adminMoreOpen : false);

                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    if (tab.action) return tab.action();
                                    if (tab.view) return setView(tab.view as AppView);
                                }}
                                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-70 transition-opacity select-none"
                                style={{ minWidth: 0, outline: 'none' }}
                                aria-label={tab.label}
                            >
                                {/* Active pill indicator */}
                                {isActive && (
                                    <span
                                        className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-blue-500"
                                        aria-hidden="true"
                                    />
                                )}

                                {/* Icon container */}
                                <span
                                    className={`relative flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200 ${isActive
                                            ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 scale-110'
                                            : 'text-zinc-400 dark:text-zinc-500'
                                        }`}
                                >
                                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />

                                    {/* Notification badge */}
                                    {(tab as any).badge > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 border-2 border-white dark:border-zinc-950">
                                            {(tab as any).badge > 9 ? '9+' : (tab as any).badge}
                                        </span>
                                    )}
                                </span>

                                {/* Label */}
                                <span
                                    className={`text-[10px] font-semibold leading-none transition-colors duration-200 truncate max-w-[3.5rem] ${isActive
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-zinc-400 dark:text-zinc-500'
                                        }`}
                                >
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};
