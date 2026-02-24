import React from 'react';
import { Sidebar } from './Sidebar';
import { BottomTabNav } from './BottomTabNav';
import { useAppStore } from '../../store';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { appMode } = useAppStore();

    if (appMode === 'landing' || appMode === 'auth') {
        return <main className="w-full h-screen overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">{children}</main>;
    }

    return (
        <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-500/30 transition-colors duration-300">
            {/* Desktop Sidebar */}
            <Sidebar />
            
            <main className="flex-1 relative flex flex-col h-full overflow-hidden w-full">
                <div className="flex-1 relative h-full w-full overflow-y-auto pb-20 lg:pb-0 hide-scrollbar">
                    {children}
                </div>
                
                {/* Mobile Bottom Navigation */}
                <BottomTabNav />
            </main>
        </div>
    );
};