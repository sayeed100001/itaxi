
import React from 'react';
import { useAppStore, AppView } from '../../store';
import { translations } from '../../constants/translations';
import { Home, Clock, Wallet, Settings, LogOut, Car, BarChart3, Users, LifeBuoy, Map, Bell, DollarSign, Moon, Sun, Sliders, MessageSquare, Zap, CreditCard, Star, FileText } from 'lucide-react';

interface NavLink {
    id: string;
    icon: React.ReactNode;
    label: string;
    badge?: number;
}

export const Sidebar: React.FC = () => {
    const { currentRole, setRole, currentView, setView, logout, user, isDarkMode, toggleDarkMode, language, notifications } = useAppStore();
    const t = translations[language];

    const unreadNotifications = notifications.filter(n => !n.read).length;

    const getLinks = (): NavLink[] => {
        const commonLinks: NavLink[] = [
            { id: 'settings', icon: <Settings size={20} />, label: t.nav.settings },
        ];

        switch (currentRole) {
            case 'DRIVER':
                return [
                    { id: 'home', icon: <Map size={20} />, label: t.nav.dashboard },
                    { id: 'drivers', icon: <BarChart3 size={20} />, label: 'My Earnings' },
                    { id: 'analytics', icon: <Star size={20} />, label: 'My Ratings' },
                    { id: 'activity', icon: <Clock size={20} />, label: t.nav.activity },
                    { id: 'wallet', icon: <Wallet size={20} />, label: 'Credits' },
                    { id: 'messages', icon: <MessageSquare size={20} />, label: 'Messages' },
                    { id: 'support', icon: <LifeBuoy size={20} />, label: t.nav.support },
                    { id: 'profile', icon: <FileText size={20} />, label: 'Vehicle & Docs' },
                    ...commonLinks
                ];
            case 'ADMIN':
                return [
                    { id: 'home', icon: <Map size={20} />, label: t.nav.live_map },
                    { id: 'drivers', icon: <Users size={20} />, label: t.nav.driver_mgmt },
                    { id: 'credits', icon: <CreditCard size={20} />, label: 'Credit Purchases' },
                    { id: 'dispatch', icon: <Zap size={20} />, label: 'Dispatch Config' },
                    { id: 'whatsapp', icon: <MessageSquare size={20} />, label: 'WhatsApp Monitor' },
                    { id: 'finance', icon: <DollarSign size={20} />, label: t.nav.finance },
                    { id: 'payouts', icon: <CreditCard size={20} />, label: 'Payouts' },
                    { id: 'reconcile', icon: <BarChart3 size={20} />, label: 'Reconciliation' },
                    { id: 'analytics', icon: <BarChart3 size={20} />, label: t.nav.analytics },
                    { id: 'admin_settings', icon: <Sliders size={20} />, label: 'System Config' },
                    ...commonLinks
                ];
            default: // rider
                return [
                    { id: 'home', icon: <Home size={20} />, label: t.nav.home },
                    { id: 'activity', icon: <Clock size={20} />, label: t.nav.activity },
                    { id: 'wallet', icon: <Wallet size={20} />, label: t.nav.wallet },
                    { id: 'notifications', icon: <Bell size={20} />, label: t.nav.notifications, badge: unreadNotifications },
                    { id: 'support', icon: <LifeBuoy size={20} />, label: t.nav.support },
                    ...commonLinks
                ];
        }
    };

    return (
        <aside className="hidden lg:flex flex-col w-72 bg-white/90 dark:bg-dark-950/95 backdrop-blur-2xl border-e border-dark-200 dark:border-white/5 h-screen transition-all duration-300 z-50">
            <div className="p-8">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/30 text-xl transform hover:scale-105 transition-transform duration-300">
                            {language === 'fa' ? 'آ' : 'iT'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold tracking-tight text-dark-900 dark:text-white leading-none">{t.brand}</span>
                            <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold tracking-[0.2em] uppercase mt-0.5">{t.slogan}</span>
                        </div>
                    </div>
                    {/* Desktop Theme Toggle */}
                    <button 
                        onClick={toggleDarkMode}
                        className="p-2 rounded-full hover:bg-dark-100 dark:hover:bg-white/10 text-dark-500 dark:text-dark-400 transition-colors"
                        aria-label="Toggle Dark Mode"
                    >
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>

                <div className="mb-8">
                    <div className="text-[10px] font-bold text-dark-400 dark:text-dark-600 uppercase tracking-widest mb-3">{t.portal_view}</div>
                    <div className="flex p-1.5 bg-dark-100 dark:bg-dark-900 rounded-xl border border-dark-200 dark:border-white/5">
                        {(() => {
                            const backendRole = user?.role;
                            const roles: ('RIDER' | 'DRIVER' | 'ADMIN')[] =
                                backendRole === 'ADMIN'
                                    ? ['RIDER', 'DRIVER', 'ADMIN']
                                    : backendRole === 'DRIVER'
                                    ? ['DRIVER']
                                    : ['RIDER'];

                            return roles.map((role) => {
                                const labelKey = role === 'DRIVER' ? 'driver' : role === 'RIDER' ? 'rider' : 'admin';
                                return (
                                    <button
                                        key={role}
                                        onClick={() => setRole(role)}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all duration-300 ${
                                            currentRole === role
                                                ? 'bg-white dark:bg-brand-600 text-dark-900 dark:text-white shadow-sm'
                                                : 'text-dark-500 hover:text-dark-800 dark:hover:text-dark-300'
                                        }`}
                                    >
                                        {t.roles[labelKey]}
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>

                <nav className="space-y-1.5">
                    {getLinks().map((link) => {
                        const isActive = currentView === link.id;
                        return (
                            <button
                                key={link.id}
                                onClick={() => setView(link.id as AppView)}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 group relative ${
                                    isActive 
                                    ? 'bg-brand-50/80 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400' 
                                    : 'text-dark-500 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-white/5 hover:text-dark-900 dark:hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{link.icon}</span>
                                    <span className="relative z-10">{link.label}</span>
                                </div>
                                {link.badge && link.badge > 0 ? (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">{link.badge}</span>
                                ) : null}
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-brand-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                )}
                            </button>
                        )
                    })}
                </nav>
            </div>

            <div className="mt-auto p-6 border-t border-dark-200 dark:border-white/5 bg-dark-50/50 dark:bg-dark-900/30">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-dark-200 dark:bg-dark-700 p-0.5 border-2 border-white dark:border-brand-500/30 shadow-md">
                         <img src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=2563eb&color=fff`} alt="User" className="w-full h-full rounded-full object-cover" />
                    </div>
                        <div className="flex-1 min-w-0 text-start">
                        <div className="text-sm font-bold text-dark-900 dark:text-white truncate">{user?.name || 'Guest User'}</div>
                        <div className="text-xs text-brand-600 dark:text-brand-400 truncate capitalize font-medium">
                            {user?.role
                                ? t.roles[
                                      user.role === 'DRIVER'
                                          ? 'driver'
                                          : user.role === 'RIDER'
                                          ? 'rider'
                                          : 'admin'
                                  ]
                                : 'Guest'}{' '}
                            Account
                        </div>
                    </div>
                </div>
                <button 
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-dark-500 dark:text-dark-400 hover:text-red-600 dark:hover:text-red-400 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                    <LogOut size={16} className="rtl:rotate-180" /> {t.common.secure_logout}
                </button>
            </div>
        </aside>
    );
};
