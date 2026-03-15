import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    Users, DollarSign, Car, ShieldCheck, Search,
    CheckCircle, XCircle, Star, RefreshCw, TrendingUp,
    Map as MapIcon, ChevronDown, ChevronUp, AlertCircle, Navigation, Phone, Globe, AlertTriangle,
    MessageCircle, Send, Clock
} from 'lucide-react';
import { useAppStore } from '../../store';
import { apiFetch } from '../../services/api';
import { MapBackground } from '../../components/Map/MapBackground';
import { TaxiBadge, type TaxiTier } from '../../components/icons/TaxiBadge';
import { latLngToCell } from 'h3-js';

interface CityStats {
    h3: string;
    lat: number;
    lng: number;
    cityName: string;
    drivers: number;
    activeDrivers: number;
    totalRides: number;
    activeRides: number;
    revenue: number;
}

interface ActiveRide {
    id: string;
    status: string;
    fare: number;
    service_type: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_lat: number;
    dropoff_lng: number;
    created_at: string;
    rider_name: string;
    rider_phone: string;
    driver_name: string | null;
    driver_phone: string | null;
    current_lat: number | null;
    current_lng: number | null;
    vehicle_model: string | null;
    vehicle_plate: string | null;
}

// ────────────── Types ──────────────
interface UserRecord {
    id: string;
    name: string;
    phone: string;
    role: 'rider' | 'driver' | 'admin';
    balance: number;
    rating: number;
    created_at: string;
    kycStatus?: string;
    driverLevel?: string;
    taxi_type?: string;
}

// ────────────── Taxi Types (Req 8 & 9) ──────────────
const TAXI_TYPES: Array<{ id: TaxiTier; label: string; sublabel: string; color: string }> = [
    { id: 'eco', label: 'Eco', sublabel: 'Simple', color: 'emerald' },
    { id: 'plus', label: 'Plus', sublabel: 'Special', color: 'blue' },
    // NOTE: Backend/DB taxi_types ids are: eco, plus, lux, premium.
    { id: 'lux', label: 'Lux', sublabel: 'Luxury', color: 'purple' },
    { id: 'premium', label: 'Premium', sublabel: 'VIP', color: 'amber' },
];

// Tailwind can't safely generate dynamic classes like `bg-${color}-50` in production builds.
// Keep the set of colors explicit so the classes are discoverable by Tailwind.
const STAT_ICON_STYLES: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400',
    zinc: 'bg-zinc-100 dark:bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
};

// ────────────── Stat Card ──────────────
const StatCard: React.FC<{
    label: string; value: string; icon: React.ReactNode;
    color: string; sub?: string; onClick?: () => void;
}> = ({ label, value, icon, color, sub, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full text-left bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm active:scale-95 transition-transform ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${STAT_ICON_STYLES[color] || STAT_ICON_STYLES.zinc}`}>
            {icon}
        </div>
        <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-xl font-black text-zinc-900 dark:text-white leading-none">{value}</p>
        {sub && <p className="text-[10px] text-zinc-400 mt-1 font-medium">{sub}</p>}
    </button>
);

// ────────────── Main Component ──────────────
export const AdminDashboard = () => {
    const { user, drivers } = useAppStore();
    const addToast = useAppStore(s => s.addToast);
    const [activeTab, setActiveTab] = useState<'overview' | 'cities' | 'users' | 'kyc' | 'map'>('overview');
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [stats, setStats] = useState({ totalUsers: 0, activeDrivers: 0, monthlyRevenue: 0, pendingKYC: 0 });
    const [activeRides, setActiveRides] = useState<ActiveRide[]>([]);
    const [selectedRide, setSelectedRide] = useState<ActiveRide | null>(null);
    const activeRidesPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [cities, setCities] = useState<CityStats[]>([]);
    const [selectedCity, setSelectedCity] = useState<CityStats | null>(null);
    const [citiesLoading, setCitiesLoading] = useState(false);
    const [sosAlerts, setSosAlerts] = useState<any[]>([]);
    const [sosLoading, setSosLoading] = useState(false);
    const [sosMessage, setSosMessage] = useState<{ alertId: string; phone: string; name: string } | null>(null);
    const [sosMessageText, setSosMessageText] = useState('');
    const [sosMsgLoading, setSosMsgLoading] = useState(false);

    const toNumber = (value: any, fallback = 0) => {
        const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
        return Number.isFinite(n) ? n : fallback;
    };

    const fetchRevenue = useCallback(async () => {
        try {
            const res = await apiFetch('/api/admin/revenue/summary?range=30d');
            if (!res.ok) return;
            const data = await res.json();
            // Show commission by default (platform 20% share); totals.total includes any extra fees too.
            const commission = Number(data?.totals?.commission ?? 0) || 0;
            setStats(prev => ({ ...prev, monthlyRevenue: commission }));
        } catch { /* non-fatal */ }
    }, []);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/api/admin/users');
            if (res.ok) {
                const data: UserRecord[] = await res.json();
                setUsers(data);
                setStats(prev => ({
                    ...prev,
                    totalUsers: data.length,
                    activeDrivers: data.filter(u => u.role === 'driver').length,
                    pendingKYC: data.filter(u => u.role === 'driver' && u.kycStatus === 'pending').length,
                }));
            }
        } catch {
            addToast('error', 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    const fetchActiveRides = useCallback(async () => {
        try {
            const res = await apiFetch('/api/admin/rides/active');
            if (res.ok) setActiveRides(await res.json());
        } catch {}
    }, []);

    const fetchCities = useCallback(async () => {
        setCitiesLoading(true);
        try {
            const res = await apiFetch('/api/admin/cities');
            if (res.ok) setCities(await res.json());
        } catch {}
        finally { setCitiesLoading(false); }
    }, []);

    const fetchSosAlerts = useCallback(async () => {
        setSosLoading(true);
        try {
            const res = await apiFetch('/api/emergency/alerts');
            if (res.ok) setSosAlerts(await res.json());
        } catch {}
        finally { setSosLoading(false); }
    }, []);

    const resolveAlert = async (alertId: string, status: 'resolved' | 'false_alarm') => {
        try {
            const res = await apiFetch('/api/emergency/resolve', {
                method: 'POST',
                body: JSON.stringify({ alertId, status })
            });
            if (res.ok) {
                addToast('success', status === 'resolved' ? 'Alert resolved' : 'Marked as false alarm');
                fetchSosAlerts();
            }
        } catch {
            addToast('error', 'Failed to resolve alert');
        }
    };

    const sendSosMessage = async () => {
        if (!sosMessage || !sosMessageText.trim()) return;
        setSosMsgLoading(true);
        try {
            const res = await apiFetch('/api/chat/send', {
                method: 'POST',
                body: JSON.stringify({
                    recipientId: sosMessage.alertId,
                    text: sosMessageText.trim(),
                    senderId: user?.id
                })
            });
            if (res.ok) {
                addToast('success', 'Message sent');
            } else {
                addToast('error', 'Failed to send message');
            }
        } catch {
            addToast('error', 'Failed to send message');
        } finally {
            setSosMsgLoading(false);
            setSosMessage(null);
            setSosMessageText('');
        }
    };

    useEffect(() => {
        if (activeTab === 'cities' && user?.role === 'admin') fetchCities();
        if (activeTab === 'sos' && user?.role === 'admin') fetchSosAlerts();
    }, [activeTab, user?.role, fetchCities, fetchSosAlerts]);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchUsers();
            fetchRevenue();
            fetchSosAlerts();
        }
    }, [user?.role, fetchUsers, fetchRevenue, fetchSosAlerts]);

    // Poll active rides when on map tab
    useEffect(() => {
        if (activeTab === 'map' && user?.role === 'admin') {
            fetchActiveRides();
            activeRidesPollRef.current = setInterval(fetchActiveRides, 6000);
        }
        if (activeTab === 'sos' && user?.role === 'admin') {
            fetchSosAlerts();
            activeRidesPollRef.current = setInterval(fetchSosAlerts, 10000);
        }
        return () => { if (activeRidesPollRef.current) clearInterval(activeRidesPollRef.current); };
    }, [activeTab, user?.role, fetchActiveRides, fetchSosAlerts]);

    const handleKYCAction = async (driverId: string, action: 'approve' | 'reject', taxiType = 'eco') => {
        if (action === 'approve') {
            try {
                const res = await apiFetch(`/api/admin/drivers/${driverId}/kyc`, {
                    method: 'POST',
                    body: JSON.stringify({ taxi_type: taxiType, initial_credit: 500 }),
                });
                if (res.ok) {
                    addToast('success', 'Driver KYC approved + ؋500 credit granted');
                    fetchUsers();
                } else {
                    addToast('error', 'KYC approval failed');
                }
            } catch {
                addToast('error', 'Network error');
            }
        } else {
            try {
                const res = await apiFetch(`/api/admin/drivers/${driverId}/kyc`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'rejected' }),
                });
                if (res.ok) {
                    addToast('info', 'KYC rejected');
                    fetchUsers();
                } else {
                    addToast('error', 'KYC rejection failed');
                }
            } catch {
                addToast('error', 'Network error');
            }
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.phone.includes(searchQuery) ||
        u.role.includes(searchQuery.toLowerCase())
    );
    const kycPending = users.filter(u => u.role === 'driver' && u.kycStatus === 'pending');

    if (user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
                <AlertCircle size={48} className="text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Access Denied</h2>
                <p className="text-zinc-500">Admin credentials required</p>
            </div>
        );
    }

    // ────── TAB CONTENT ──────
    const TABS = [
        { id: 'overview', label: 'Overview', icon: TrendingUp },
        { id: 'cities', label: 'Cities', icon: Globe },
        { id: 'users', label: `Users (${stats.totalUsers})`, icon: Users },
        { id: 'kyc', label: `KYC ${stats.pendingKYC > 0 ? `(${stats.pendingKYC})` : ''}`, icon: ShieldCheck },
        { id: 'sos', label: `SOS ${sosAlerts.length > 0 ? `(${sosAlerts.length})` : ''}`, icon: AlertTriangle },
        { id: 'map', label: 'Map', icon: MapIcon },
    ];

    // City-filtered active rides
    const cityActiveRides = selectedCity
        ? activeRides.filter(r => {
            if (!r.pickup_lat || !r.pickup_lng) return false;
            try { return latLngToCell(r.pickup_lat, r.pickup_lng, 4) === selectedCity.h3; }
            catch { return false; }
          })
        : activeRides;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* ── In-App Message Modal (portal-level, always on top) ── */}
            {sosMessage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={e => { if (e.target === e.currentTarget) { setSosMessage(null); setSosMessageText(''); } }}
                >
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl p-5 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                                <MessageCircle size={18} className="text-red-500" />
                            </div>
                            <div>
                                <p className="font-bold text-zinc-900 dark:text-white text-sm">{sosMessage.name}</p>
                                <p className="text-xs text-zinc-400">{sosMessage.phone}</p>
                            </div>
                        </div>
                        <textarea
                            autoFocus
                            value={sosMessageText}
                            onChange={e => setSosMessageText(e.target.value)}
                            placeholder="Type your message..."
                            rows={4}
                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setSosMessage(null); setSosMessageText(''); }}
                                className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm font-bold active:scale-95 transition-transform"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={sendSosMessage}
                                disabled={sosMsgLoading || !sosMessageText.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
                            >
                                {sosMsgLoading
                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <><Send size={14} /> Send Message</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-20 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 pt-3 pb-0">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-base font-black text-zinc-900 dark:text-white leading-tight">
                            <span className="inline-flex items-center gap-2">
                                <span className="w-7 h-7 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-sm">
                                    <Car size={16} className="text-blue-600 dark:text-blue-400" />
                                </span>
                                iTaxi Admin
                            </span>
                        </h1>
                        <p className="text-[11px] text-zinc-400 font-medium">Master Control · Afghanistan</p>
                    </div>
                    <button
                        onClick={() => { fetchUsers(); fetchRevenue(); }}
                        disabled={isLoading}
                        className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 active:scale-90 transition-transform shadow-sm"
                    >
                        <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Tab Bar — scrollable horizontal */}
                <div className="flex gap-1.5 overflow-x-auto pb-3 hide-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab.id
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md'
                                    : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                                }`}
                        >
                            <span className="inline-flex items-center gap-2">
                                <tab.icon size={14} className={activeTab === tab.id ? 'opacity-90' : 'opacity-70'} />
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="px-4 pt-4 pb-2">

                {/* OVERVIEW */}
                {activeTab === 'overview' && (
                    <div className="space-y-4 animate-fadeInUp">
                        {/* 2×2 grid on mobile, 4-col on desktop */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} icon={<Users size={18} />} color="blue" sub="Registered accounts" />
                            <StatCard label="Revenue" value={`؋${stats.monthlyRevenue > 999 ? (stats.monthlyRevenue / 1000).toFixed(1) + 'k' : stats.monthlyRevenue}`} icon={<DollarSign size={18} />} color="green" sub="20% commission" />
                            <StatCard label="Drivers" value={String(stats.activeDrivers)} icon={<Car size={18} />} color="purple" sub="Registered fleet" />
                            <StatCard label="KYC Queue" value={String(stats.pendingKYC)} icon={<ShieldCheck size={18} />} color="orange" sub={stats.pendingKYC > 0 ? 'Needs review' : 'All clear'} onClick={() => setActiveTab('kyc')} />
                        </div>

                        {/* SOS Alert Banner */}
                        {sosAlerts.length > 0 && (
                            <button
                                onClick={() => setActiveTab('sos' as any)}
                                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border-2 border-red-300 dark:border-red-500/40 animate-pulse"
                            >
                                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
                                    <AlertTriangle size={20} className="text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-bold text-red-700 dark:text-red-400 text-sm">{sosAlerts.length} Active SOS Alert{sosAlerts.length > 1 ? 's' : ''}</p>
                                    <p className="text-xs text-red-500">Tap to view and respond</p>
                                </div>
                            </button>
                        )}

                        {/* Fleet by category */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <TrendingUp size={15} className="text-blue-500" /> Fleet by Category
                            </h3>
                            <div className="grid grid-cols-4 gap-2">
                                {TAXI_TYPES.map(t => {
                                    const count = users.filter(u => u.role === 'driver' && u.taxi_type === t.id).length;
                                    return (
                                        <div key={t.id} className="text-center bg-zinc-50 dark:bg-zinc-800/60 rounded-xl py-3 px-1">
                                            <div className="mb-1 flex justify-center">
                                                <TaxiBadge tier={t.id} size={30} className="rounded-xl shadow-[0_10px_24px_rgba(0,0,0,0.12)]" />
                                            </div>
                                            <div className="text-sm font-black text-zinc-900 dark:text-white">{count}</div>
                                            <div className="text-[10px] text-zinc-400 font-medium">{t.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Drivers in Map preview */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <MapIcon size={15} className="text-blue-500" />
                                    Live Fleet — {drivers.filter(d => d.status === 'available').length} online
                                </h3>
                                <button onClick={() => setActiveTab('map')} className="text-[11px] font-bold text-blue-500">
                                    View Full Map →
                                </button>
                            </div>
                            <div className="h-40 relative bg-zinc-100 dark:bg-zinc-800">
                                <MapBackground drivers={drivers.filter(d => d.status === 'available')} showHotels={false} />
                            </div>
                        </div>
                    </div>
                )}

                {/* USERS */}
                {activeTab === 'users' && (
                    <div className="space-y-3 animate-fadeInUp">
                        {/* Search */}
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search name, phone, role..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            />
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col items-center py-16 gap-3">
                                <div className="w-8 h-8 border-2 border-zinc-200 border-t-blue-500 rounded-full animate-spin" />
                                <p className="text-sm text-zinc-500">Loading users...</p>
                            </div>
                        ) : (
                            /* Mobile-friendly card list instead of table */
                            <div className="space-y-2">
                                {filteredUsers.map(u => {
                                    const isExpanded = expandedUser === u.id;
                                    return (
                                        <div key={u.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                                            <button
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-zinc-50 dark:active:bg-zinc-800 transition-colors"
                                                onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                                            >
                                                {/* Avatar */}
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>

                                                {/* Name + phone */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{u.name}</p>
                                                    <p className="text-[11px] text-zinc-400 font-mono">{u.phone}</p>
                                                </div>

                                                {/* Role badge */}
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                        u.role === 'driver' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                    }`}>
                                                    {u.role}
                                                </span>

                                                {isExpanded ? <ChevronUp size={14} className="text-zinc-400 shrink-0" /> : <ChevronDown size={14} className="text-zinc-400 shrink-0" />}
                                            </button>

                                            {/* Expanded details */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
                                                    <div className="grid grid-cols-3 gap-2">
                                                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2 text-center">
                                                                <p className="text-[10px] text-zinc-400 font-medium">Balance</p>
                                                                <p className="text-sm font-bold text-green-600">؋{toNumber(u.balance, 0).toLocaleString()}</p>
                                                            </div>
                                                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2 text-center">
                                                                <p className="text-[10px] text-zinc-400 font-medium">Rating</p>
                                                                <p className="text-sm font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-0.5">
                                                                    <Star size={10} className="fill-yellow-400 text-yellow-400" />
                                                                    {toNumber(u.rating, 5).toFixed(1)}
                                                                </p>
                                                            </div>
                                                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2 text-center">
                                                            <p className="text-[10px] text-zinc-400 font-medium">KYC</p>
                                                            <p className={`text-[11px] font-bold ${u.kycStatus === 'approved' ? 'text-green-600' : u.kycStatus === 'pending' ? 'text-yellow-600' : 'text-zinc-400'}`}>
                                                                {u.kycStatus || 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {u.role === 'driver' && (
                                                        <p className="text-[11px] text-zinc-500">
                                                            Vehicle: <span className="font-bold text-zinc-700 dark:text-zinc-300">{TAXI_TYPES.find(t => t.id === u.taxi_type)?.label || 'Unassigned'}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredUsers.length === 0 && !isLoading && (
                                    <div className="py-16 text-center text-zinc-400">
                                        <Users size={40} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm font-medium">No users found</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* CITIES */}
                {activeTab === 'cities' && (
                    <div className="space-y-3 animate-fadeInUp">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Globe size={15} className="text-blue-500" />
                                Active Cities ({cities.length})
                            </h2>
                            <button
                                onClick={fetchCities}
                                disabled={citiesLoading}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 active:scale-90 transition-transform"
                            >
                                <RefreshCw size={13} className={citiesLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {citiesLoading ? (
                            <div className="flex flex-col items-center py-16 gap-3">
                                <div className="w-8 h-8 border-2 border-zinc-200 border-t-blue-500 rounded-full animate-spin" />
                                <p className="text-sm text-zinc-500">Detecting cities...</p>
                            </div>
                        ) : cities.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 py-16 text-center">
                                <Globe size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
                                <p className="text-sm font-bold text-zinc-500">No city data yet</p>
                                <p className="text-xs text-zinc-400 mt-1">Cities appear when drivers go online or rides are created</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cities.map(city => (
                                    <div key={city.h3}
                                        className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden cursor-pointer transition-all ${
                                            selectedCity?.h3 === city.h3
                                                ? 'border-blue-400 dark:border-blue-500 shadow-md'
                                                : 'border-zinc-100 dark:border-zinc-800'
                                        }`}
                                        onClick={() => {
                                            setSelectedCity(selectedCity?.h3 === city.h3 ? null : city);
                                            if (selectedCity?.h3 !== city.h3) {
                                                fetchActiveRides();
                                                setActiveTab('map' as any);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-3 px-4 py-3.5">
                                            {/* Activity indicator */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                city.activeDrivers > 0 || city.activeRides > 0
                                                    ? 'bg-green-50 dark:bg-green-500/10'
                                                    : 'bg-zinc-100 dark:bg-zinc-800'
                                            }`}>
                                                <Globe size={18} className={city.activeDrivers > 0 || city.activeRides > 0 ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{city.cityName}</p>
                                                    {(city.activeDrivers > 0 || city.activeRides > 0) && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-[10px] text-zinc-400">
                                                        <span className="font-bold text-zinc-600 dark:text-zinc-300">{city.activeDrivers}</span> online drivers
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400">
                                                        <span className="font-bold text-zinc-600 dark:text-zinc-300">{city.activeRides}</span> active trips
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <div className="text-sm font-black text-zinc-900 dark:text-white">
                                                    ؋{city.revenue > 999 ? (city.revenue / 1000).toFixed(1) + 'k' : Math.round(city.revenue)}
                                                </div>
                                                <div className="text-[10px] text-zinc-400">{city.totalRides} rides/30d</div>
                                            </div>
                                        </div>

                                        {/* Stats bar */}
                                        <div className="grid grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
                                            {[
                                                { label: 'Drivers', value: city.drivers },
                                                { label: 'Active', value: city.activeDrivers },
                                                { label: 'Trips (30d)', value: city.totalRides },
                                            ].map(s => (
                                                <div key={s.label} className="bg-white dark:bg-zinc-900 py-2 text-center">
                                                    <div className="text-sm font-black text-zinc-900 dark:text-white">{s.value}</div>
                                                    <div className="text-[9px] text-zinc-400 font-medium uppercase tracking-wide">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* SOS ALERTS */}
                {activeTab === 'sos' && (
                    <div className="space-y-3 animate-fadeInUp">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500" />
                                Active SOS Alerts ({sosAlerts.length})
                            </h2>
                            <button
                                onClick={fetchSosAlerts}
                                disabled={sosLoading}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 active:scale-90 transition-transform"
                            >
                                <RefreshCw size={13} className={sosLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {sosLoading ? (
                            <div className="flex flex-col items-center py-16 gap-3">
                                <div className="w-8 h-8 border-2 border-zinc-200 border-t-red-500 rounded-full animate-spin" />
                                <p className="text-sm text-zinc-500">Loading alerts...</p>
                            </div>
                        ) : sosAlerts.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 py-16 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle size={26} className="text-green-600 dark:text-green-400" />
                                </div>
                                <p className="font-bold text-zinc-900 dark:text-white text-sm">No Active SOS Alerts</p>
                                <p className="text-xs text-zinc-400 mt-1">All clear — no emergencies reported</p>
                            </div>
                        ) : (
                            sosAlerts.map((alert: any) => (
                                <div key={alert.id} className="bg-white dark:bg-zinc-900 rounded-2xl border-2 border-red-200 dark:border-red-900/50 overflow-hidden">
                                    {/* Header */}
                                    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-900/30">
                                        <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0 animate-pulse">
                                            <AlertTriangle size={18} className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-red-700 dark:text-red-400">{alert.rider_name || 'Unknown Rider'}</p>
                                            <p className="text-[11px] text-red-500 font-mono">{alert.rider_phone || 'No phone'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">ACTIVE</span>
                                            {alert.created_at && (
                                                <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                                                    <Clock size={9} />
                                                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="px-4 py-3 space-y-2.5">
                                        {/* Rider Info + Actions */}
                                        <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-3">
                                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1.5">🚨 RIDER IN DISTRESS</p>
                                            <p className="font-bold text-sm text-zinc-900 dark:text-white">{alert.rider_name || 'Unknown'}</p>
                                            {alert.rider_phone && (
                                                <div className="flex gap-2 mt-2">
                                                    <a
                                                        href={`tel:${alert.rider_phone}`}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95 transition-transform"
                                                    >
                                                        <Phone size={12} /> Call Rider
                                                    </a>
                                                    <a
                                                        href={`https://wa.me/${alert.rider_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`🚨 iTaxi Emergency: We received your SOS alert. Are you safe? Our team is on the way.`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 text-white text-xs font-bold active:scale-95 transition-transform"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                        WhatsApp
                                                    </a>
                                                    <button
                                                        onClick={() => setSosMessage({ alertId: alert.rider_id || alert.user_id, phone: alert.rider_phone, name: alert.rider_name })}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-700 text-white text-xs font-bold active:scale-95 transition-transform"
                                                    >
                                                        <MessageCircle size={12} /> Message
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Driver Info */}
                                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">🚗 DRIVER</p>
                                            <p className="font-bold text-sm text-zinc-900 dark:text-white">{alert.driver_name || 'No driver assigned'}</p>
                                            {alert.driver_phone && (
                                                <div className="flex gap-2 mt-2">
                                                    <a
                                                        href={`tel:${alert.driver_phone}`}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95 transition-transform"
                                                    >
                                                        <Phone size={12} /> Call Driver
                                                    </a>
                                                    <a
                                                        href={`https://wa.me/${alert.driver_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`🚨 iTaxi Emergency: Your passenger has triggered an SOS alert. Please ensure their safety immediately.`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 text-white text-xs font-bold active:scale-95 transition-transform"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                        WhatsApp
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        {/* Location */}
                                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">📍 LOCATION & ROUTE</p>
                                            {(alert.lat && alert.lng) && (
                                                <a
                                                    href={`https://maps.google.com/?q=${alert.lat},${alert.lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-blue-500 font-bold text-sm mb-2"
                                                >
                                                    <Navigation size={14} /> View Live Location on Map
                                                </a>
                                            )}
                                            {alert.pickup_address && (
                                                <p className="text-xs text-zinc-500 mb-0.5">From: <span className="font-bold text-zinc-700 dark:text-zinc-300">{alert.pickup_address}</span></p>
                                            )}
                                            {alert.dropoff_address && (
                                                <p className="text-xs text-zinc-500">To: <span className="font-bold text-zinc-700 dark:text-zinc-300">{alert.dropoff_address}</span></p>
                                            )}
                                            {(alert.lat && alert.lng && alert.dropoff_address) && (
                                                <a
                                                    href={`https://maps.google.com/dir/${alert.lat},${alert.lng}/${encodeURIComponent(alert.dropoff_address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-2 flex items-center gap-1.5 text-xs text-blue-500 font-bold"
                                                >
                                                    <Navigation size={11} /> Full Route on Google Maps
                                                </a>
                                            )}
                                        </div>

                                        {/* Resolve Actions */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => resolveAlert(alert.id, 'resolved')}
                                                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform"
                                            >
                                                <CheckCircle size={13} /> Resolved
                                            </button>
                                            <button
                                                onClick={() => resolveAlert(alert.id, 'false_alarm')}
                                                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold active:scale-95 transition-transform border border-zinc-200 dark:border-zinc-700"
                                            >
                                                <XCircle size={13} /> False Alarm
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                    </div>
                )}

                {/* KYC */}
                {activeTab === 'kyc' && (
                    <div className="space-y-3 animate-fadeInUp">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck size={16} className="text-orange-500" />
                                Pending Review ({kycPending.length})
                            </h2>
                        </div>

                        {kycPending.length === 0 ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 py-16 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle size={26} className="text-green-600 dark:text-green-400" />
                                </div>
                                <p className="font-bold text-zinc-900 dark:text-white text-sm">All Clear</p>
                                <p className="text-xs text-zinc-400 mt-1">No pending KYC verifications</p>
                            </div>
                        ) : (
                            kycPending.map(driver => (
                                <KYCCard key={driver.id} driver={driver} onAction={handleKYCAction} />
                            ))
                        )}
                    </div>
                )}

                {/* MAP */}
                {activeTab === 'map' && (
                    <div className="animate-fadeInUp space-y-3">
                        {/* City filter badge */}
                        {selectedCity && (
                            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2">
                                <Globe size={13} className="text-blue-500 shrink-0" />
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex-1">{selectedCity.cityName}</span>
                                <button onClick={() => setSelectedCity(null)} className="text-[10px] text-blue-500 font-bold">Clear</button>
                            </div>
                        )}
                        {/* Map */}
                        <div className="rounded-2xl overflow-hidden relative bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                            style={{ height: 'calc(100dvh - 26rem)' }}>
                            <MapBackground
                                drivers={drivers.filter(d => d.status === 'available' || d.status === 'busy')}
                                showHotels={false}
                                center={selectedCity ? { lat: selectedCity.lat, lng: selectedCity.lng } : undefined}
                                zoom={selectedCity ? 12 : undefined}
                            />
                            <div className="absolute top-3 left-3 right-3 z-10">
                                <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl px-3 py-2.5 shadow-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                            {cityActiveRides.filter(r => ['accepted','in_progress'].includes(r.status)).length} Active · {cityActiveRides.filter(r => ['searching','requested'].includes(r.status)).length} Searching
                                            {selectedCity ? ` · ${selectedCity.cityName}` : ''}
                                        </span>
                                    </div>
                                    <button onClick={fetchActiveRides} className="text-[10px] text-blue-500 font-bold">Refresh</button>
                                </div>
                            </div>
                        </div>

                        {/* Active Rides List */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1">
                                Active Trips ({cityActiveRides.length})
                            </h3>
                            {cityActiveRides.length === 0 ? (
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 py-10 text-center">
                                    <Car size={32} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                                    <p className="text-sm text-zinc-400">No active trips right now</p>
                                </div>
                            ) : cityActiveRides.map(ride => (
                                <div key={ride.id}
                                    className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden cursor-pointer transition-colors ${
                                        selectedRide?.id === ride.id
                                            ? 'border-blue-400 dark:border-blue-500'
                                            : 'border-zinc-100 dark:border-zinc-800'
                                    }`}
                                    onClick={() => setSelectedRide(selectedRide?.id === ride.id ? null : ride)}
                                >
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        {/* Status dot */}
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                            ride.status === 'in_progress' ? 'bg-green-500 animate-pulse' :
                                            ride.status === 'accepted' ? 'bg-blue-500' :
                                            'bg-yellow-500 animate-pulse'
                                        }`} />

                                        {/* Rider */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                                    🧍 {ride.rider_name || 'Unknown Rider'}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                                                    ride.status === 'in_progress' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    ride.status === 'accepted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                }`}>{ride.status}</span>
                                            </div>
                                            <div className="text-[10px] text-zinc-400 truncate">
                                                🚗 {ride.driver_name || 'No driver yet'}
                                                {ride.vehicle_plate ? ` · ${ride.vehicle_plate}` : ''}
                                            </div>
                                        </div>

                                        {/* Fare */}
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-black text-zinc-900 dark:text-white">؋{ride.fare}</div>
                                            <div className="text-[10px] text-zinc-400">{ride.service_type}</div>
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {selectedRide?.id === ride.id && (
                                        <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5">
                                                    <p className="text-[10px] text-zinc-400 font-bold mb-1">RIDER</p>
                                                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{ride.rider_name}</p>
                                                    {ride.rider_phone && (
                                                        <a href={`tel:${ride.rider_phone}`} className="flex items-center gap-1 text-[10px] text-blue-500 mt-0.5">
                                                            <Phone size={10} /> {ride.rider_phone}
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5">
                                                    <p className="text-[10px] text-zinc-400 font-bold mb-1">DRIVER</p>
                                                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{ride.driver_name || '—'}</p>
                                                    {ride.driver_phone && (
                                                        <a href={`tel:${ride.driver_phone}`} className="flex items-center gap-1 text-[10px] text-blue-500 mt-0.5">
                                                            <Phone size={10} /> {ride.driver_phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2.5 space-y-1">
                                                <div className="flex items-start gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0" />
                                                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug">{ride.pickup_address}</p>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
                                                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug">{ride.dropoff_address}</p>
                                                </div>
                                            </div>
                                            {ride.vehicle_model && (
                                                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                                    <Car size={12} />
                                                    {ride.vehicle_model} {ride.vehicle_plate ? `· ${ride.vehicle_plate}` : ''}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ────────────── KYC Card ──────────────
const KYCCard: React.FC<{
    driver: UserRecord;
    onAction: (id: string, action: 'approve' | 'reject', taxiType?: string) => void;
}> = ({ driver, onAction }) => {
    const [selectedType, setSelectedType] = useState('eco');

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border-2 border-orange-200/60 dark:border-orange-900/40 overflow-hidden">
            {/* Driver Info */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold">
                    {driver.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{driver.name}</p>
                    <p className="text-[11px] text-zinc-400 font-mono">{driver.phone}</p>
                </div>
                <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-[10px] font-bold inline-flex items-center gap-1.5">
                    <RefreshCw size={12} className="opacity-70" />
                    Pending
                </span>
            </div>

            {/* Vehicle Type Selector (Req 8 & 9) */}
            <div className="px-4 py-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Assign Vehicle Category</p>
                <div className="grid grid-cols-4 gap-1.5">
                    {TAXI_TYPES.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setSelectedType(t.id)}
                            className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all active:scale-95 ${selectedType === t.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                                }`}
                        >
                            <TaxiBadge tier={t.id} size={28} className="rounded-xl shadow-[0_10px_24px_rgba(0,0,0,0.10)]" />
                            <span className={`text-[10px] font-bold mt-0.5 ${selectedType === t.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}`}>
                                {t.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                <button
                    onClick={() => onAction(driver.id, 'approve', selectedType)}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform shadow-sm"
                >
                    <CheckCircle size={14} /> Approve + ؋500
                </button>
                <button
                    onClick={() => onAction(driver.id, 'reject')}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-red-500 text-xs font-bold active:scale-95 transition-transform border border-red-200 dark:border-red-900/40"
                >
                    <XCircle size={14} /> Reject
                </button>
            </div>
        </div>
    );
};
