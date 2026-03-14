
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { MapPin, Calendar, Clock, ChevronRight, X, DollarSign, Map as MapIcon, User } from 'lucide-react';
import { useAppStore } from '../../store';
import { Ride } from '../../types';
import { useI18n } from '../../services/useI18n';

export const ActivityPage: React.FC = () => {
    const pastTrips = useAppStore((state) => state.pastTrips);
    const [loading, setLoading] = useState(true);
    const [selectedTrip, setSelectedTrip] = useState<Ride | null>(null);
    const { t } = useI18n();

    useEffect(() => {
        // Simulate local loading for effect
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    // Sort trips by date desc
    const sortedTrips = [...pastTrips].sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 1.875rem)' }} className="font-bold text-slate-900 dark:text-white tracking-tight">{t.pages.activity.title}</h1>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{t.pages.activity.desc}</p>
                </div>
            </header>

            <div className="space-y-4">
                {loading ? (
                    // Loading Skeletons
                    [1, 2, 3].map((i) => (
                        <div key={i} className="p-5 rounded-2xl border border-slate-100 dark:border-white/5 bg-white dark:bg-white/[0.02]">
                            <div className="flex gap-4">
                                <Skeleton variant="rectangular" className="w-32 h-24 rounded-lg" />
                                <div className="flex-1 space-y-3 py-1">
                                    <div className="flex justify-between">
                                        <Skeleton variant="text" className="w-40 h-6" />
                                        <Skeleton variant="text" className="w-20 h-6" />
                                    </div>
                                    <div className="flex gap-4">
                                        <Skeleton variant="text" className="w-24 h-4" />
                                        <Skeleton variant="text" className="w-24 h-4" />
                                    </div>
                                    <Skeleton variant="text" className="w-full h-4 mt-2" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    sortedTrips.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.pages.activity.empty_title}</h3>
                            <p className="text-slate-500">{t.pages.activity.empty_desc}</p>
                        </div>
                    ) :
                        // Actual Data
                        sortedTrips.map((ride) => (
                            <Card key={ride.id} onClick={() => setSelectedTrip(ride)} className="group hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border border-slate-100 dark:border-white/5 hover:border-brand-500/30 animate-in slide-in-from-bottom-2 fade-in duration-500 p-3 md:p-4">
                                <div className="flex flex-row md:items-center gap-3 md:gap-4">
                                    {/* Map Thumbnail Placeholder */}
                                    <div className="w-16 h-16 md:w-32 md:h-24 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden shrink-0 relative grayscale group-hover:grayscale-0 transition-all">
                                        <div className="absolute inset-0 bg-slate-300/50 dark:bg-slate-700/50 flex items-center justify-center">
                                            <MapPin size={16} className="text-slate-500 dark:text-slate-500 group-hover:text-brand-500 dark:group-hover:text-brand-400" />
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-lg line-clamp-1">{ride.destination}</h3>
                                            <div className="text-sm md:text-lg font-bold text-slate-900 dark:text-white">؋{ride.fare ? parseFloat(ride.fare.toString()).toFixed(0) : '0'}</div>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-1"><Calendar size={14} /> {new Date(ride.timestamp).toLocaleDateString()}</div>
                                            <div className="flex items-center gap-1"><Clock size={14} /> {new Date(ride.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20">{ride.status}</div>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span className="truncate max-w-[150px]">{ride.pickup}</span>
                                            <span className="text-slate-400 dark:text-slate-600">➜</span>
                                            <span className="truncate max-w-[150px]">{ride.destination}</span>
                                        </div>
                                    </div>

                                    <div className="hidden md:block">
                                        <ChevronRight className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </Card>
                        ))
                )}
            </div>

            {/* Trip Details Modal */}
            {selectedTrip && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <Card className="w-full max-w-lg relative overflow-hidden bg-white dark:bg-slate-900 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.pages.activity.modal_title}</h2>
                            <button onClick={() => setSelectedTrip(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Route Visualization Placeholder */}
                            <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl relative overflow-hidden border border-slate-200 dark:border-white/5 flex items-center justify-center">
                                <MapIcon size={48} className="text-slate-300 dark:text-slate-700 opacity-50" />
                                <div className="absolute bottom-2 right-2 bg-white/80 dark:bg-black/50 px-2 py-1 rounded text-xs font-mono">
                                    {(selectedTrip.distance / 1000).toFixed(1)} km
                                </div>
                            </div>

                            {/* Locations */}
                            <div className="space-y-6 relative">
                                <div className="absolute left-[11px] top-3 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                                <div className="flex gap-4 relative">
                                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0 z-10 ring-4 ring-white dark:ring-slate-900">
                                        <div className="w-2 h-2 bg-current rounded-full"></div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.pages.activity.pickup}</div>
                                        <div className="font-bold text-slate-900 dark:text-white">{selectedTrip.pickup}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{new Date(selectedTrip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 relative">
                                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 z-10 ring-4 ring-white dark:ring-slate-900">
                                        <MapPin size={12} fill="currentColor" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.pages.activity.dropoff}</div>
                                        <div className="font-bold text-slate-900 dark:text-white">{selectedTrip.destination}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{new Date(selectedTrip.timestamp + selectedTrip.duration * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Fare Breakdown */}
                            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><DollarSign size={16} /> {t.pages.activity.payment_receipt}</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-500">
                                        <span>{t.pages.activity.trip_fare}</span>
                                        <span>؋{selectedTrip.fare ? parseFloat(selectedTrip.fare.toString()).toFixed(2) : '0.00'}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>{t.pages.activity.platform_fee}</span>
                                        <span>؋0.00</span>
                                    </div>
                                    <div className="border-t border-slate-200 dark:border-white/10 my-2 pt-2 flex justify-between font-bold text-slate-900 dark:text-white text-base">
                                        <span>{t.pages.activity.total}</span>
                                        <span>؋{selectedTrip.fare ? parseFloat(selectedTrip.fare.toString()).toFixed(2) : '0.00'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Driver */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                    <User size={20} className="text-slate-500 dark:text-slate-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{t.pages.activity.completed_by_driver}</div>
                                    <div className="text-xs text-slate-500">{selectedTrip.driverId ? `ID: ${selectedTrip.driverId}` : t.pages.activity.unknown_driver}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                            <button className="w-full py-3 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-xl font-bold text-slate-700 dark:text-white transition-colors text-sm">
                                {t.pages.activity.report_issue}
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
