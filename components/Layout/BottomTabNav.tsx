
import React from 'react';
import { useAppStore, AppView } from '../../store';
import { Home, Map, Wallet, User, MessageCircle, List, Settings, Users, Bell } from 'lucide-react';

export const BottomTabNav: React.FC = () => {
    const { currentRole, currentView, setView, notifications } = useAppStore();
    const unreadNotifications = notifications.filter(n => !n.read).length;

    const getTabs = () => {
        // Driver Tabs
        if (currentRole === 'DRIVER') {
            return [
                { id: 'home', icon: <Map size={24} />, label: 'Home', view: 'home' }, // Dashboard
                { id: 'trips', icon: <List size={24} />, label: 'Trips', view: 'activity' },
                { id: 'wallet', icon: <Wallet size={24} />, label: 'Wallet', view: 'wallet' },
                { id: 'messages', icon: <MessageCircle size={24} />, label: 'Chat', view: 'messages' },
                { id: 'profile', icon: <User size={24} />, label: 'Profile', view: 'profile' },
            ];
        }
        
        // Admin Tabs
        if (currentRole === 'ADMIN') {
             return [
                { id: 'home', icon: <Map size={24} />, label: 'Map', view: 'home' },
                { id: 'drivers', icon: <Users size={24} />, label: 'Drivers', view: 'drivers' },
                { id: 'finance', icon: <Wallet size={24} />, label: 'Finance', view: 'finance' },
                { id: 'messages', icon: <MessageCircle size={24} />, label: 'Support', view: 'messages' },
                { id: 'admin_settings', icon: <Settings size={24} />, label: 'Admin', view: 'admin_settings' },
            ];
        }

        // Passenger Tabs (Default)
        return [
            { id: 'home', icon: <Home size={24} />, label: 'Home', view: 'home' },
            { id: 'activity', icon: <List size={24} />, label: 'Trips', view: 'activity' },
            { id: 'notifications', icon: <Bell size={24} />, label: 'Alerts', view: 'notifications', badge: unreadNotifications },
            { id: 'wallet', icon: <Wallet size={24} />, label: 'Wallet', view: 'wallet' },
            { id: 'profile', icon: <User size={24} />, label: 'Profile', view: 'profile' },
        ];
    };

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-dark-950/95 backdrop-blur-md border-t border-dark-200 dark:border-white/10 pb-safe z-50 transition-colors duration-300 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center h-16 px-2">
                {getTabs().map((tab) => {
                    const isActive = currentView === tab.view;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.view as AppView)}
                            className="relative flex flex-col items-center justify-center w-full h-full space-y-1 group active:scale-95 transition-transform"
                        >
                            <div className="relative">
                                <div className={`transition-all duration-300 transform rounded-xl p-1 ${isActive ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 -translate-y-1' : 'text-dark-400 dark:text-dark-500'}`}>
                                    {tab.icon}
                                </div>
                                {tab.badge && tab.badge > 0 ? (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white dark:border-dark-950">
                                        {tab.badge}
                                    </div>
                                ) : null}
                            </div>
                            <span className={`text-[10px] font-bold transition-colors duration-300 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-dark-400 dark:text-dark-500'}`}>
                                {tab.label}
                            </span>
                            {isActive && (
                                <div className="absolute -bottom-2 w-1 h-1 rounded-full bg-brand-600 dark:bg-brand-400"></div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
