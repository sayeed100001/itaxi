
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, MapPin, Clock, DollarSign, User, Car, Calendar, Filter } from 'lucide-react';
import { useAppStore } from '../../store';
import { apiFetch } from '../../services/api';

export const AdminRidesPage: React.FC = () => {
    const [rides, setRides] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'searching' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'>('all');

    useEffect(() => {
        fetchRides();
    }, []);

    const fetchRides = async () => {
        try {
            const res = await apiFetch('/api/admin/rides');
            if (res.ok) {
                const data = await res.json();
                setRides(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const filteredRides = rides.filter(r => {
        const matchesSearch = r.rider_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              r.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              r.pickup_address?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const totalRides = rides.length;
    const completedRides = rides.filter(r => r.status === 'completed').length;
    const cancelledRides = rides.filter(r => r.status === 'cancelled').length;
    // This page shows gross fare volume; platform revenue is available in Admin Analytics via revenue summary.
    const totalRevenue = rides.filter(r => r.status === 'completed').reduce((acc, r) => acc + parseFloat(r.fare || 0), 0);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'completed': return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20';
            case 'in_progress': return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
            case 'accepted': return 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
            case 'cancelled': return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20';
            default: return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20';
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-dark-50 dark:bg-dark-950">
            <header className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-dark-900 dark:text-white">Rides Management</h1>
                <p className="text-dark-500 dark:text-dark-400">Monitor and manage all ride requests and trips.</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Total Rides</div>
                        <div className="text-3xl font-black text-dark-900 dark:text-white">{totalRides}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                        <Car size={24}/>
                    </div>
                </Card>
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Completed</div>
                        <div className="text-3xl font-black text-green-600 dark:text-green-400">{completedRides}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                        <Clock size={24}/>
                    </div>
                </Card>
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Cancelled</div>
                        <div className="text-3xl font-black text-red-600 dark:text-red-400">{cancelledRides}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                        <Clock size={24}/>
                    </div>
                </Card>
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Total Revenue</div>
                        <div className="text-2xl font-black text-dark-900 dark:text-white">؋{totalRevenue.toLocaleString()}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                        <DollarSign size={24}/>
                    </div>
                </Card>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-dark-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by rider, driver, or location..." 
                        className="w-full pl-12 pr-4 py-2.5 sm:py-3 rounded-2xl bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 focus:ring-2 focus:ring-brand-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    {['all', 'searching', 'accepted', 'in_progress', 'completed', 'cancelled'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status as any)}
                            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold capitalize whitespace-nowrap ${filterStatus === status ? 'bg-brand-500 text-white' : 'bg-white dark:bg-dark-900 text-dark-500 border border-dark-200 dark:border-white/10'}`}
                        >
                            {status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile List */}
            <div className="space-y-3 lg:hidden">
                {filteredRides.map((ride) => {
                    const rideIdShort = (ride.id || '').toString().slice(0, 8);
                    const fare = Number.parseFloat(ride.fare || 0) || 0;

                    return (
                        <Card key={ride.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-mono text-[11px] text-dark-500 bg-dark-100 dark:bg-dark-900 px-2 py-1 rounded-lg inline-block">
                                        #{rideIdShort || 'N/A'}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <User size={16} className="text-dark-400 shrink-0" />
                                        <span className="font-bold text-sm text-dark-900 dark:text-white truncate">{ride.rider_name || 'Unknown'}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-dark-500">
                                        <Car size={14} className="text-dark-400 shrink-0" />
                                        <span className="font-semibold truncate">{ride.driver_name || 'Not assigned'}</span>
                                    </div>
                                </div>
                                <span className={`shrink-0 inline-flex px-2.5 py-1 rounded-lg text-xs font-bold capitalize border ${getStatusColor(ride.status)}`}>
                                    {String(ride.status || '').replace('_', ' ')}
                                </span>
                            </div>

                            <div className="mt-3 space-y-2">
                                <div className="flex items-start gap-2 text-xs text-dark-500">
                                    <MapPin size={14} className="text-green-500 mt-0.5 shrink-0" />
                                    <span className="line-clamp-2">{ride.pickup_address || '-'}</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs text-dark-500">
                                    <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                                    <span className="line-clamp-2">{ride.dropoff_address || '-'}</span>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="text-xs text-dark-500 flex items-center gap-1.5">
                                    <Calendar size={14} />
                                    {ride.created_at ? new Date(ride.created_at).toLocaleDateString() : '-'}
                                </div>
                                <div className="font-mono font-black text-base text-dark-900 dark:text-white">؋{fare.toLocaleString()}</div>
                            </div>
                        </Card>
                    );
                })}
                {filteredRides.length === 0 && (
                    <Card className="p-8 text-center text-dark-500">No rides found.</Card>
                )}
            </div>

            {/* Desktop Table */}
            <Card className="overflow-hidden hidden lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="border-b border-dark-100 dark:border-white/5 text-xs font-bold text-dark-400 uppercase bg-dark-50/50 dark:bg-white/[0.02]">
                                <th className="p-5">Ride ID</th>
                                <th className="p-5">Rider</th>
                                <th className="p-5">Driver</th>
                                <th className="p-5">Route</th>
                                <th className="p-5">Status</th>
                                <th className="p-5">Fare</th>
                                <th className="p-5">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                            {filteredRides.map((ride) => (
                                <tr key={ride.id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.02]">
                                    <td className="p-5">
                                        <span className="font-mono text-xs bg-dark-100 dark:bg-dark-800 px-2 py-1 rounded">#{ride.id.slice(0, 8)}</span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-2">
                                            <User size={16} className="text-dark-400"/>
                                            <span className="font-bold text-sm">{ride.rider_name || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-2">
                                            <Car size={16} className="text-dark-400"/>
                                            <span className="font-bold text-sm">{ride.driver_name || 'Not assigned'}</span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="space-y-1">
                                            <div className="text-xs text-dark-500 flex items-center gap-1">
                                                <MapPin size={12} className="text-green-500"/>
                                                {ride.pickup_address?.substring(0, 30)}...
                                            </div>
                                            <div className="text-xs text-dark-500 flex items-center gap-1">
                                                <MapPin size={12} className="text-red-500"/>
                                                {ride.dropoff_address?.substring(0, 30)}...
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold capitalize border ${getStatusColor(ride.status)}`}>
                                            {ride.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <span className="font-mono font-bold text-lg">؋{parseFloat(ride.fare || 0).toLocaleString()}</span>
                                    </td>
                                    <td className="p-5">
                                        <div className="text-sm text-dark-500 flex items-center gap-1.5">
                                            <Calendar size={14}/>
                                            {new Date(ride.created_at).toLocaleDateString()}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredRides.length === 0 && (
                    <div className="p-12 text-center text-dark-500">No rides found.</div>
                )}
            </Card>
        </div>
    );
};
