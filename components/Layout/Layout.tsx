import React from 'react';
import { Sidebar } from './Sidebar';
import { BottomTabNav } from './BottomTabNav';
import { useAppStore } from '../../store';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const appMode = useAppStore((state) => state.appMode);
    const currentRole = useAppStore((state) => state.currentRole);
    const currentView = useAppStore((state) => state.currentView);

    if (appMode === 'landing' || appMode === 'auth') {
        return (
            <main className="w-full min-h-dvh overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
                {children}
            </main>
        );
    }

    // Admin pages & scrollable content pages need scroll
    const isScrollableView = currentRole === 'admin' ||
        ['wallet', 'finance', 'activity', 'trips', 'drivers', 'profile', 'settings',
            'support', 'notifications', 'messages', 'admin_settings'].includes(currentView);

    return (
        <div className="flex h-dvh w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
            {/* Desktop Sidebar — hidden on mobile */}
            <Sidebar />

            <main className="flex-1 relative flex flex-col h-full w-full min-w-0">
                {isScrollableView ? (
                    /* Scrollable content pages */
                    <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
                        style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="pb-24 lg:pb-6">
                            {children}
                        </div>
                    </div>
                ) : (
                    /* Map / full-screen pages */
                    <div className="flex-1 relative w-full overflow-hidden">
                        {children}
                    </div>
                )}

                {/* Mobile Bottom Navigation */}
                <BottomTabNav />
            </main>
        </div>
    );
};
