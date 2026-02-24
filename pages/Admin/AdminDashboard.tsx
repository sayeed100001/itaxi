
import React from 'react';
import { useAppStore } from '../../store';
import { MapBackground } from '../../components/Map/MapBackground';
import { Card } from '../../components/ui/Card';
import { Car, Users, Zap, Radio } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
    const { drivers, userLocation, pastTrips, user } = useAppStore();
    
    // Real-time stats from actual data
    const online = drivers.filter(d => d.status !== 'offline' && d.status !== 'suspended').length;
    const busy = drivers.filter(d => d.status === 'busy').length;
    const available = drivers.filter(d => d.status === 'available').length;
    const totalTrips = pastTrips.length;
    const activeUsers = drivers.length + 1; // Drivers + current admin

    return (
        <div className="relative h-full w-full">
            {/* Full Screen Live Map */}
            <MapBackground 
                center={userLocation}
                zoom={13}
                isDriverView={true} // Cleaner markers
            />

            {/* Floating Operations HUD */}
            <div className="absolute top-6 left-6 z-20 space-y-4 max-w-xs w-full">
                <Card className="bg-white/90 dark:bg-dark-900/90 backdrop-blur-md border border-dark-200 dark:border-white/10 shadow-2xl p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                        <h2 className="font-black text-dark-900 dark:text-white uppercase tracking-widest text-xs">Live Operations</h2>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-xl border border-brand-100 dark:border-brand-500/20">
                            <div className="text-brand-600 dark:text-brand-400 font-bold text-2xl">{drivers.length}</div>
                            <div className="text-[10px] text-brand-600/70 dark:text-brand-400/70 font-bold uppercase">Total Fleet</div>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-100 dark:border-green-500/20">
                            <div className="text-green-600 dark:text-green-400 font-bold text-2xl">{online}</div>
                            <div className="text-[10px] text-green-600/70 dark:text-green-400/70 font-bold uppercase">Online</div>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-100 dark:border-orange-500/20">
                            <div className="text-orange-600 dark:text-orange-400 font-bold text-2xl">{busy}</div>
                            <div className="text-[10px] text-orange-600/70 dark:text-orange-400/70 font-bold uppercase">On Trip</div>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
                            <div className="text-blue-600 dark:text-blue-400 font-bold text-2xl">{available}</div>
                            <div className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-bold uppercase">Available</div>
                        </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-dark-100 dark:border-white/10 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-dark-500 flex items-center gap-2"><Car size={14}/> On Trip</span>
                            <span className="font-bold text-dark-900 dark:text-white">{busy}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-dark-500 flex items-center gap-2"><Users size={14}/> Total Trips</span>
                            <span className="font-bold text-dark-900 dark:text-white">{totalTrips}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-dark-500 flex items-center gap-2"><Zap size={14}/> Available</span>
                            <span className="font-bold text-green-500">{available}</span>
                        </div>
                    </div>
                </Card>

                <Card className="bg-white/90 dark:bg-dark-900/90 backdrop-blur-md border border-dark-200 dark:border-white/10 shadow-lg p-3 flex items-center gap-3 animate-pulse-slow">
                     <Radio className="text-red-500" size={20} />
                     <div className="text-xs font-bold text-dark-600 dark:text-dark-300">System operating normally</div>
                </Card>
            </div>
        </div>
    );
};
