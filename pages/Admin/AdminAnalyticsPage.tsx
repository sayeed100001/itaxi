
import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area } from 'recharts';
import { TrendingUp, Users, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { apiFetch } from '../../services/api';

export const AdminAnalyticsPage: React.FC = () => {
    const [stats, setStats] = useState({ 
        totalDrivers: 0, 
        totalRides: 0, 
        totalRevenue: 0,
        ridesByType: [
            { name: 'City Taxi', value: 400, color: '#3b82f6' },
            { name: 'Plus', value: 300, color: '#8b5cf6' },
            { name: 'Lux', value: 100, color: '#f59e0b' }
        ],
        mixedData: [
            { time: '00:00', rides: 0, revenue: 0 }
        ],
        csat: 4.8,
        onTime: 92,
        criticalReports: 2
    });
    
    useEffect(() => {
        apiFetch('/api/admin/stats')
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error(err));
    }, []);

    const kpiData = [
        { label: 'Active Drivers', value: (stats.totalDrivers || 0).toString(), change: '+12%', icon: Users, color: 'text-blue-500' },
        { label: 'Total Revenue', value: `؋${(stats.totalRevenue || 0).toLocaleString()}`, change: '+8%', icon: TrendingUp, color: 'text-green-500' },
        { label: 'Total Rides', value: (stats.totalRides || 0).toString(), change: '+15%', icon: Clock, color: 'text-purple-500' },
        { label: 'Active Zones', value: '8', change: 'Stable', icon: MapPin, color: 'text-orange-500' },
    ];

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-dark-50 dark:bg-dark-950 transition-colors duration-300">
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-dark-900 dark:text-white tracking-tight">Analytics & Reports</h1>
                    <p className="text-dark-500 dark:text-dark-400">Operational intelligence and performance metrics.</p>
                </div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    <button className="bg-white dark:bg-white/10 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm whitespace-nowrap">Last 24h</button>
                    <button className="text-dark-500 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold hover:text-dark-900 dark:hover:text-white whitespace-nowrap">7 Days</button>
                    <button className="text-dark-500 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold hover:text-dark-900 dark:hover:text-white whitespace-nowrap">30 Days</button>
                </div>
            </header>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
                {kpiData.map((kpi, idx) => (
                    <Card key={idx} className="flex items-center gap-3 sm:gap-4 hover:border-brand-500/30 transition-colors cursor-default">
                        <div className={`w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm ${kpi.color}`}>
                            <kpi.icon size={24} />
                        </div>
                        <div>
                            <div className="text-dark-500 text-xs font-bold uppercase tracking-wider">{kpi.label}</div>
                            <div className="text-2xl font-black text-dark-900 dark:text-white">{kpi.value}</div>
                            <div className={`text-xs font-bold ${kpi.change.startsWith('+') ? 'text-green-500' : kpi.change.startsWith('-') ? 'text-red-500' : 'text-dark-400'}`}>
                                {kpi.change} vs prev
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Main Trend Chart */}
                <Card className="lg:col-span-2">
                    <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Demand vs Revenue</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
                            <ComposedChart data={stats.mixedData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#71717a'}} />
                                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fill: '#71717a'}} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#71717a'}} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }}
                                />
                                <Bar yAxisId="left" dataKey="rides" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Donut Chart */}
                <Card>
                    <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Fleet Distribution</h3>
                    <div className="h-60 w-full flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                            <PieChart>
                                <Pie
                                    data={stats.ridesByType}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.ridesByType.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-dark-900 dark:text-white">{stats.totalRides}</span>
                            <span className="text-xs text-dark-500 uppercase font-bold">Total Rides</span>
                        </div>
                    </div>
                    <div className="space-y-2 mt-4">
                        {(stats.ridesByType || []).map(item => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></span>
                                    <span className="text-dark-700 dark:text-dark-300">{item.name}</span>
                                </div>
                                <span className="font-bold text-dark-900 dark:text-white">{stats.totalRides > 0 ? Math.round((item.value/stats.totalRides)*100) : 0}%</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Live Demand & Safety Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-dark-900 dark:text-white">Live Demand Zones</h3>
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">LIVE</span>
                    </div>
                    <div className="h-64 bg-white dark:bg-dark-900 rounded-xl border border-dark-200 dark:border-white/10 overflow-auto">
                        {(stats as any).surgeZones?.length ? (
                            <div className="p-4 space-y-3">
                                {(stats as any).surgeZones.map((z: any, idx: number) => (
                                    <div key={z.id || idx} className="flex items-center justify-between p-3 rounded-lg bg-dark-50 dark:bg-white/[0.03]">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-brand-500" />
                                            <div>
                                                <div className="font-bold text-dark-900 dark:text-white">{z.name || `Zone ${idx + 1}`}</div>
                                                <div className="text-xs text-dark-500">Multiplier: {(Number(z.multiplier) || 1).toFixed(2)} • Active: {z.active ? 'Yes' : 'No'}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-dark-500">{z.city || '-'}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-sm text-dark-500">
                                No active zones yet.
                            </div>
                        )}
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Safety & Quality</h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-dark-500">Customer Satisfaction (CSAT)</span>
                                <span className="font-bold text-dark-900 dark:text-white">{stats.csat.toFixed(1)}/5.0</span>
                            </div>
                            <div className="h-2 bg-dark-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500" style={{width: `${(stats.csat/5)*100}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-dark-500">On-Time Arrival</span>
                                <span className="font-bold text-dark-900 dark:text-white">{stats.onTime}%</span>
                            </div>
                            <div className="h-2 bg-dark-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500" style={{width: `${stats.onTime}%`}}></div>
                            </div>
                        </div>
                         <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle className="text-red-500 shrink-0" size={20} />
                            <div>
                                <div className="text-sm font-bold text-red-700 dark:text-red-400">{stats.criticalReports} Critical Safety Reports</div>
                                <div className="text-xs text-red-600/80 dark:text-red-400/70 mt-1">Requires immediate review in Support portal.</div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
