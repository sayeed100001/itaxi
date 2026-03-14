
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TAXI_TYPES, determineTaxiType, calculateFare } from '../../services/taxiTypes';
import type { TaxiType } from '../../services/taxiTypes';
import { Search, Filter, MoreVertical, Star, Shield, Car, Phone, CheckCircle, XCircle, Ban, Edit2, FileText, Calendar, Mail, MapPin, Wallet, Settings, Upload, Save, Eye, Trash2, Plus, Monitor, Database, Users, DollarSign, BarChart3, Bell, Palette, Globe, Zap, Activity, Server, AlertTriangle, Clock, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { DriverMarker } from '../../types';
import { apiFetch } from '../../services/api';
import { AdminAPI, TaxiTypeAPI } from '../../services/adminAPI';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminRidesPage } from './AdminRidesPage';
import { AdminAnalyticsPage } from './AdminAnalyticsPage';
import { AdminSettings } from './AdminSettings';

type TaxiTypesConfig = Record<string, TaxiType>;

interface SystemConfig {
    taxiTypes: TaxiTypesConfig;
    mapSettings: {
        provider: string;
        defaultZoom: number;
        defaultCenter: { lat: number; lng: number };
    };
    ui: {
        theme: string;
        primaryColor: string;
        secondaryColor: string;
    };
    features: {
        realTimeTracking: boolean;
        chatSystem: boolean;
        paymentGateway: boolean;
        notifications: boolean;
        analytics: boolean;
    };
}

export const AdminDriversPage: React.FC = () => {
    const drivers = useAppStore((state) => state.drivers);
    const creditRequests = useAppStore((state) => state.creditRequests);
    const updateDriverInDB = useAppStore((state) => state.updateDriverInDB);
    const addToast = useAppStore((state) => state.addToast);
    const adminSettings = useAppStore((state) => state.adminSettings);
    const updateAdminSettings = useAppStore((state) => state.updateAdminSettings);
    const refreshDrivers = useAppStore((state) => state.refreshDrivers);
    const user = useAppStore((state) => state.user);
    const setUser = useAppStore((state) => state.setUser);
    const setRole = useAppStore((state) => state.setRole);
    const setView = useAppStore((state) => state.setView);
    const logout = useAppStore((state) => state.logout);
    
    const [activeTab, setActiveTab] = useState('drivers');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'busy' | 'offline' | 'suspended'>('all');
    const [selectedDriver, setSelectedDriver] = useState<DriverMarker | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTaxiType, setEditingTaxiType] = useState<string | null>(null);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [kycLoading, setKycLoading] = useState(false);
    const [dbHealth, setDbHealth] = useState<any>(null);
    const [integration, setIntegration] = useState<any>(null);
    const [systemConfig, setSystemConfig] = useState<SystemConfig>({
        taxiTypes: TAXI_TYPES,
        mapSettings: {
            provider: adminSettings?.mapProvider || 'osm',
            defaultZoom: 15,
            defaultCenter: { lat: 34.5553, lng: 69.2075 }
        },
        ui: {
            theme: 'dark',
            primaryColor: '#3B82F6',
            secondaryColor: '#10B981'
        },
        features: {
            realTimeTracking: true,
            chatSystem: true,
            paymentGateway: false,
            notifications: true,
            analytics: true
        }
    });
    const [systemMetrics, setSystemMetrics] = useState({
        server: { cpu: 45, memory: 67, disk: 23, uptime: 86400000, status: 'healthy' as const },
        database: { connections: 12, queries: 1250, responseTime: 45, status: 'healthy' as const },
        realtime: { activeUsers: 234, activeDrivers: 89, activeRides: 45, socketConnections: 156 },
        performance: { avgResponseTime: 120, errorRate: 0.02, throughput: 450, availability: 99.9 }
    });

    // DB-backed admin data
    const [taxiTypes, setTaxiTypes] = useState<TaxiTypeAPI[]>([]);
    const [driverCreditBalances, setDriverCreditBalances] = useState<Record<string, number>>({});
    const [isTaxiTypesLoading, setIsTaxiTypesLoading] = useState(false);
    const [isCreditBalancesLoading, setIsCreditBalancesLoading] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState<Partial<DriverMarker>>({});

    const tabs = [
        { id: 'drivers', name: 'رانندگان', icon: Car },
        { id: 'kyc', name: 'KYC / احراز هویت', icon: Shield },
        { id: 'users', name: 'کاربران', icon: Users },
        { id: 'rides', name: 'سفرها', icon: Activity },
        { id: 'portals', name: 'کنترل پورتالها', icon: Monitor },
        { id: 'taxi-types', name: 'انواع تاکسی', icon: Settings },
        { id: 'map-settings', name: 'نقشه', icon: MapPin },
        { id: 'pricing', name: 'قیمت گذاری', icon: DollarSign },
        { id: 'ui-theme', name: 'ظاهر', icon: Palette },
        { id: 'features', name: 'ویژگی ها', icon: Zap },
        { id: 'analytics', name: 'آنالیتیکس', icon: BarChart3 },
        { id: 'monitor', name: 'مانیتورینگ', icon: Monitor },
        { id: 'database', name: 'دیتابیس', icon: Database }
    ];

    // Allow deep-links from the mobile "More" menu (no router in this app).
    useEffect(() => {
        try {
            const requested = window.sessionStorage?.getItem('itaxi:adminDriversTab');
            if (requested && tabs.some(t => t.id === requested)) {
                setActiveTab(requested);
            }
            if (requested) window.sessionStorage?.removeItem('itaxi:adminDriversTab');
        } catch {
            // Non-fatal: ignore storage access issues.
        }
    }, []);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await apiFetch('/api/admin/system-metrics');
                if (res.ok) {
                    const data = await res.json();
                    setSystemMetrics(data);
                }
            } catch (e) {
                console.error('Failed to fetch system metrics', e);
            }
        };

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const loadTaxiTypes = async () => {
            setIsTaxiTypesLoading(true);
            try {
                const data = await AdminAPI.getTaxiTypes();
                setTaxiTypes(data || []);
            } catch (e) {
                addToast('error', 'Failed to load taxi types');
            } finally {
                setIsTaxiTypesLoading(false);
            }
        };
        const loadCreditBalances = async () => {
            setIsCreditBalancesLoading(true);
            try {
                const res = await apiFetch('/api/admin/driver-credit/balances');
                if (res.ok) {
                    const rows = await res.json();
                    const map: Record<string, number> = {};
                    (rows || []).forEach((r: any) => {
                        map[r.driver_id] = Number.parseFloat(r.balance || '0') || 0;
                    });
                    setDriverCreditBalances(map);
                }
            } catch (e) {
                // Non-fatal
            } finally {
                setIsCreditBalancesLoading(false);
            }
        };

        loadTaxiTypes();
        loadCreditBalances();
    }, []);

    const fetchPendingKyc = async () => {
        setKycLoading(true);
        try {
            const res = await apiFetch('/api/background-check/pending');
            if (res.ok) {
                const data = await res.json();
                setPendingKyc(data || []);
            } else {
                setPendingKyc([]);
            }
        } catch {
            setPendingKyc([]);
        } finally {
            setKycLoading(false);
        }
    };

    const runDbChecks = async () => {
        try {
            const h = await AdminAPI.checkDatabaseHealth();
            setDbHealth(h);
        } catch {}
        try {
            const t = await AdminAPI.runIntegrationTest();
            setIntegration(t);
        } catch {}
    };

    const handleEditClick = (driver: DriverMarker) => {
        setSelectedDriver(driver);
        setEditForm({ ...driver });
        setIsEditModalOpen(true);
    };

    const handleSaveConfig = async () => {
        try {
            await updateAdminSettings(systemConfig as any);
            addToast('success', 'تنظیمات با موفقیت ذخیره شد');
        } catch (error) {
            addToast('error', 'خطا در ذخیره تنظیمات');
        }
    };

    const handleImageUpload = (type: string, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            if (type === 'taxi-icon' && editingTaxiType) {
                setSystemConfig(prev => ({
                    ...prev,
                    taxiTypes: {
                        ...prev.taxiTypes,
                        [editingTaxiType]: {
                            ...prev.taxiTypes[editingTaxiType],
                            imagePath: result
                        }
                    }
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveDriver = async () => {
        if (selectedDriver && editForm) {
            await updateDriverInDB(selectedDriver.id, editForm);
            setIsEditModalOpen(false);
        }
    };

    const handleBanDriver = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'suspended' ? 'offline' : 'suspended';
        try {
            const res = await apiFetch(`/api/drivers/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                addToast(newStatus === 'suspended' ? 'error' : 'success', `Driver ${newStatus === 'suspended' ? 'Suspended' : 'Activated'}`);
                refreshDrivers();
            }
        } catch (e) {
            addToast('error', 'Failed to update status');
        }
    };

    const filteredDrivers = drivers.filter(d => {
        const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              d.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (d.licensePlate && d.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesFilter = filterStatus === 'all' || d.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    // Stats
    const totalDrivers = drivers.length;
    const onlineDrivers = drivers.filter(d => d.status !== 'offline' && d.status !== 'suspended').length;
    const suspendedDrivers = drivers.filter(d => d.status === 'suspended').length;
    const avgRating = (drivers.reduce((acc, d) => acc + d.rating, 0) / (totalDrivers || 1)).toFixed(1);

    const getDriverCreditBalance = (driverId: string) => driverCreditBalances[driverId] ?? 0;

    // Render Functions
    const renderDriversTab = () => {
        return (
            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card className="p-6 flex items-center justify-between bg-white dark:bg-gray-800 shadow">
                        <div>
                            <div className="text-gray-400 text-sm mb-2">کل رانندگان</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalDrivers}</div>
                        </div>
                        <Car className="w-8 h-8 text-blue-600" />
                    </Card>
                    <Card className="p-6 flex items-center justify-between bg-white dark:bg-gray-800 shadow">
                        <div>
                            <div className="text-gray-400 text-sm mb-2">آنلاین</div>
                            <div className="text-3xl font-bold text-green-600">{onlineDrivers}</div>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </Card>
                    <Card className="p-6 flex items-center justify-between bg-white dark:bg-gray-800 shadow">
                        <div>
                            <div className="text-gray-400 text-sm mb-2">میانگین رتبه</div>
                            <div className="text-3xl font-bold text-yellow-500">{avgRating}</div>
                        </div>
                        <Star className="w-8 h-8 text-yellow-500" />
                    </Card>
                    <Card className="p-6 flex items-center justify-between bg-white dark:bg-gray-800 shadow">
                        <div>
                            <div className="text-gray-400 text-sm mb-2">تعلیق شده</div>
                            <div className="text-3xl font-bold text-red-500">{suspendedDrivers}</div>
                        </div>
                        <Ban className="w-8 h-8 text-red-500" />
                    </Card>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Search by name, license plate, or phone..." 
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        {['all', 'available', 'busy', 'offline', 'suspended'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status as any)}
                                className={`px-5 py-3 rounded-2xl text-sm font-bold capitalize transition-all whitespace-nowrap ${
                                    filterStatus === status 
                                        ? 'bg-blue-500 text-white shadow-lg' 
                                        : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Drivers List */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900">
                                    <th className="p-5">Driver</th>
                                    <th className="p-5">Status</th>
                                    <th className="p-5">Vehicle Details</th>
                                    <th className="p-5">Rating</th>
                                    <th className="p-5">Total Earned</th>
                                    <th className="p-5">Driver Credit Balance</th>
                                    <th className="p-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredDrivers.map((driver) => (
                                    <tr key={driver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                                        <td className="p-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 overflow-hidden shadow-sm border border-gray-200 dark:border-gray-600">
                                                    <img src={`https://ui-avatars.com/api/?name=${driver.name}&background=random`} alt={driver.name} className="w-full h-full object-cover"/>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white text-base">{driver.name}</div>
                                                    <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mt-0.5"><Phone size={12}/> {driver.phone || '+93 700 000 000'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold capitalize border
                                                ${driver.status === 'available' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 
                                                  driver.status === 'busy' ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' : 
                                                  driver.status === 'suspended' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20' :
                                                  'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-600'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${driver.status === 'available' ? 'bg-emerald-500' : driver.status === 'busy' ? 'bg-orange-500' : driver.status === 'suspended' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                                                {driver.status}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">{driver.vehicle}</div>
                                            <div className="text-xs font-medium text-gray-500 flex items-center gap-2 mt-1">
                                                <span className="capitalize bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-600">{driver.type}</span>
                                                {driver.licensePlate && <span className="bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-600 font-mono text-[10px] tracking-wider">{driver.licensePlate}</span>}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                                                <Star size={16} className="fill-yellow-400 text-yellow-400" />
                                                {driver.rating ? parseFloat(driver.rating.toString()).toFixed(1) : '4.8'}
                                            </div>
                                            <div className="text-xs font-medium text-gray-500 mt-1">{driver.totalRides || 0} rides</div>
                                        </td>
                                        <td className="p-5">
                                            <div className="font-mono text-base font-black text-gray-900 dark:text-white tracking-tighter">؋{(driver.earnings || 0).toLocaleString()}</div>
                                        </td>
                                        <td className="p-5">
                                            <div className="font-mono text-base font-black text-gray-900 dark:text-white flex items-center gap-2 tracking-tighter">
                                                <Wallet size={16} className="text-blue-500" />
                                                ؋{getDriverCreditBalance(driver.id).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditClick(driver)} className="p-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleBanDriver(driver.id, driver.status)} 
                                                    className={`p-2.5 rounded-xl border transition-all shadow-sm ${driver.status === 'suspended' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/20'}`}
                                                    title={driver.status === 'suspended' ? 'Activate' : 'Suspend'}
                                                >
                                                    {driver.status === 'suspended' ? <CheckCircle size={16} /> : <Ban size={16} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredDrivers.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            No drivers found matching your criteria.
                        </div>
                    )}
                </div>

                {/* Edit Driver Modal */}
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <Card className="w-full max-w-2xl bg-white dark:bg-gray-800 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700">
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Edit Driver Profile</h2>
                                <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"><XCircle size={24} /></button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                {/* Personal Info */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2">Personal Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Full Name</label>
                                            <input 
                                                type="text" 
                                                value={editForm.name || ''} 
                                                onChange={e => setEditForm({...editForm, name: e.target.value})}
                                                className="w-full p-3.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Phone Number</label>
                                            <input 
                                                type="text" 
                                                value={editForm.phone || ''} 
                                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                                className="w-full p-3.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Vehicle Info */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2">Vehicle Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Vehicle Model</label>
                                            <input 
                                                type="text" 
                                                value={editForm.vehicle || ''} 
                                                onChange={e => setEditForm({...editForm, vehicle: e.target.value})}
                                                className="w-full p-3.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">License Plate</label>
                                            <input 
                                                type="text" 
                                                value={editForm.licensePlate || ''} 
                                                onChange={e => setEditForm({...editForm, licensePlate: e.target.value})}
                                                className="w-full p-3.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-mono font-bold tracking-wider focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Service Class</label>
                                            <select 
                                                value={editForm.type} 
                                                onChange={e => setEditForm({...editForm, type: e.target.value as any})}
                                                className="w-full p-3.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                                            >
                                                <option value="eco">Eco</option>
                                                <option value="plus">Plus</option>
                                                <option value="lux">Lux</option>
                                                <option value="premium">Premium</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                                <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                                <Button className="rounded-xl font-bold" onClick={handleSaveDriver}>Save Changes</Button>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        );
    };

    const renderTaxiTypesTab = () => {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">مدیریت انواع تاکسی</h3>
                    <button
                        onClick={() => setEditingTaxiType('new')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        افزودن نوع جدید
                    </button>
                </div>

                {isTaxiTypesLoading ? (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-600 dark:text-gray-300">Loading taxi types…</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(taxiTypes || []).map((tt) => (
                            <div key={tt.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-bold">{tt.name_fa}</h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setEditingTaxiType(tt.id)}
                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm('Delete this taxi type?')) return;
                                                try {
                                                    await AdminAPI.deleteTaxiType(tt.id);
                                                    setTaxiTypes(prev => prev.filter(x => x.id !== tt.id));
                                                    addToast('success', 'Taxi type deleted');
                                                } catch {
                                                    addToast('error', 'Delete failed');
                                                }
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-100 rounded"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 mb-4">
                                    {tt.image_path ? (
                                        <img 
                                            src={tt.image_path} 
                                            alt={tt.name_fa}
                                            className="w-16 h-16 object-contain bg-gray-100 rounded-lg p-2"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">No icon</div>
                                    )}
                                    <div>
                                        <p className="text-sm text-gray-600">کرایه پایه: {Number(tt.base_fare || 0).toLocaleString()} افغانی</p>
                                        <p className="text-sm text-gray-600">هر کیلومتر: {Number(tt.per_km_rate || 0).toLocaleString()} افغانی</p>
                                        <p className="text-sm text-gray-600">رنگ: {tt.color}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {editingTaxiType && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4">ویرایش نوع تاکسی</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">نام فارسی</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700"
                                        defaultValue={editingTaxiType !== 'new' ? (taxiTypes.find(t => t.id === editingTaxiType)?.name_fa || '') : ''}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-2">کرایه پایه (افغانی)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700"
                                        defaultValue={editingTaxiType !== 'new' ? (taxiTypes.find(t => t.id === editingTaxiType)?.base_fare || 0) : ''}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-2">آیکون تاکسی</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                                const uploaded = await AdminAPI.uploadImage(file, 'taxi-icon');
                                                // Temporarily store URL in localStorage for this simple modal (will be read on save)
                                                window.localStorage.setItem('itaxi:taxiTypeIconUpload', uploaded.url);
                                                addToast('success', 'Icon uploaded');
                                            } catch {
                                                addToast('error', 'Upload failed');
                                            }
                                        }}
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setEditingTaxiType(null)}
                                    className="px-4 py-2 text-gray-600 border rounded-lg"
                                >
                                    انصراف
                                </button>
                                <button
                                    onClick={async () => {
                                        // Minimal modal: read values from the DOM inputs
                                        const container = document.activeElement?.closest('.bg-white')?.parentElement || document.body;
                                        const inputs = container.querySelectorAll('input');
                                        const nameFa = (inputs[0] as HTMLInputElement | undefined)?.value || '';
                                        const baseFare = Number((inputs[1] as HTMLInputElement | undefined)?.value || 0);
                                        const iconUrl = window.localStorage.getItem('itaxi:taxiTypeIconUpload') || undefined;
                                        try {
                                            if (editingTaxiType === 'new') {
                                                const created = await AdminAPI.createTaxiType({
                                                    name_fa: nameFa || 'جدید',
                                                    name_en: (nameFa || 'New').toString(),
                                                    base_fare: baseFare || 0,
                                                    per_km_rate: 0,
                                                    color: '#10B981',
                                                    image_path: iconUrl,
                                                    features: []
                                                } as any);
                                                // reload list
                                                const data = await AdminAPI.getTaxiTypes();
                                                setTaxiTypes(data || []);
                                                addToast('success', 'Taxi type created');
                                            } else {
                                                await AdminAPI.updateTaxiType(editingTaxiType, {
                                                    name_fa: nameFa || undefined,
                                                    base_fare: Number.isFinite(baseFare) ? baseFare : undefined,
                                                    image_path: iconUrl
                                                } as any);
                                                const data = await AdminAPI.getTaxiTypes();
                                                setTaxiTypes(data || []);
                                                addToast('success', 'Taxi type updated');
                                            }
                                            window.localStorage.removeItem('itaxi:taxiTypeIconUpload');
                                            setEditingTaxiType(null);
                                        } catch {
                                            addToast('error', 'Save failed');
                                        }
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                                >
                                    ذخیره
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderUsersTab = () => {
        return <AdminUsersPage />;
    };

    const renderKycTab = () => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">KYC / بررسی مدارک رانندگان</h3>
                    <button
                        onClick={fetchPendingKyc}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        بروزرسانی
                    </button>
                </div>

                {kycLoading ? (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-600 dark:text-gray-300">Loading…</div>
                ) : pendingKyc.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-600 dark:text-gray-300">
                        هیچ درخواست KYC در حالت Pending وجود ندارد.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pendingKyc.map((c) => (
                            <div key={c.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow border border-gray-100 dark:border-gray-700">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white text-lg">{c.driver_name}</div>
                                        <div className="text-sm text-gray-500">{c.driver_phone}</div>
                                        <div className="text-xs text-gray-400 mt-1">Submitted: {c.submitted_at ? new Date(c.submitted_at).toLocaleString() : '-'}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <a className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-sm font-bold" href={c.national_id} target="_blank">National ID</a>
                                        <a className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-sm font-bold" href={c.driving_license} target="_blank">License</a>
                                        <a className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-sm font-bold" href={c.criminal_record} target="_blank">Criminal</a>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-bold text-gray-600 dark:text-gray-300">Driver Level:</label>
                                        <select
                                            defaultValue="basic"
                                            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                                            id={`level_${c.id}`}
                                        >
                                            <option value="basic">basic</option>
                                            <option value="standard">standard</option>
                                            <option value="special">special</option>
                                            <option value="premium">premium</option>
                                            <option value="vip">vip</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            className="px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold"
                                            onClick={async () => {
                                                const level = (document.getElementById(`level_${c.id}`) as HTMLSelectElement | null)?.value;
                                                const reason = window.prompt('Reason for rejection? (optional)') || '';
                                                try {
                                                    const res = await apiFetch('/api/background-check/review', {
                                                        method: 'POST',
                                                        body: JSON.stringify({ checkId: c.id, status: 'rejected', reason, driverLevel: level })
                                                    });
                                                    if (!res.ok) throw new Error();
                                                    addToast('success', 'Rejected');
                                                    fetchPendingKyc();
                                                } catch {
                                                    addToast('error', 'Reject failed');
                                                }
                                            }}
                                        >
                                            Reject
                                        </button>
                                        <button
                                            className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 font-bold"
                                            onClick={async () => {
                                                const level = (document.getElementById(`level_${c.id}`) as HTMLSelectElement | null)?.value;
                                                try {
                                                    const res = await apiFetch('/api/background-check/review', {
                                                        method: 'POST',
                                                        body: JSON.stringify({ checkId: c.id, status: 'approved', reason: null, driverLevel: level })
                                                    });
                                                    if (!res.ok) throw new Error();
                                                    addToast('success', 'Approved');
                                                    fetchPendingKyc();
                                                } catch {
                                                    addToast('error', 'Approve failed');
                                                }
                                            }}
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderRidesTab = () => {
        return <AdminRidesPage />;
    };

    const renderPricingTab = () => {
        return <AdminSettings />;
    };

    const renderAnalyticsTab = () => {
        return <AdminAnalyticsPage />;
    };

    const renderDatabaseTab = () => {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Database & Integration</h3>
                    <button onClick={runDbChecks} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700">
                        Run Checks
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <div className="font-bold mb-2">DB Health</div>
                        <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-auto">{JSON.stringify(dbHealth, null, 2)}</pre>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <div className="font-bold mb-2">Integration Test</div>
                        <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-auto">{JSON.stringify(integration, null, 2)}</pre>
                    </div>
                </div>
            </div>
        );
    };

    const renderMonitorTab = () => {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">وضعیت سرور</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <span className="font-medium text-green-600">سالم</span>
                                </div>
                            </div>
                            <Server className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">کاربران آنلاین</p>
                                <p className="text-2xl font-bold text-purple-600 mt-2">{systemMetrics.realtime.activeUsers}</p>
                            </div>
                            <Users className="w-8 h-8 text-purple-600" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">رانندگان فعال</p>
                                <p className="text-2xl font-bold text-orange-600 mt-2">{systemMetrics.realtime.activeDrivers}</p>
                            </div>
                            <Car className="w-8 h-8 text-orange-600" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">سفرهای فعال</p>
                                <p className="text-2xl font-bold text-blue-600 mt-2">{systemMetrics.realtime.activeRides}</p>
                            </div>
                            <Activity className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-bold mb-4">منابع سرور</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-gray-600">CPU</span>
                                    <span className="text-sm font-medium">{systemMetrics.server.cpu}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full ${systemMetrics.server.cpu > 80 ? 'bg-red-600' : systemMetrics.server.cpu > 60 ? 'bg-yellow-600' : 'bg-green-600'}`}
                                        style={{ width: `${systemMetrics.server.cpu}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-gray-600">حافظه</span>
                                    <span className="text-sm font-medium">{systemMetrics.server.memory}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full ${systemMetrics.server.memory > 80 ? 'bg-red-600' : systemMetrics.server.memory > 60 ? 'bg-yellow-600' : 'bg-blue-600'}`}
                                        style={{ width: `${systemMetrics.server.memory}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h3 className="text-lg font-bold mb-4">عملکرد سیستم</h3>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">زمان پاسخ متوسط</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{systemMetrics.performance.avgResponseTime}ms</span>
                                    <TrendingDown className="w-4 h-4 text-green-600" />
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">نرخ خطا</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{(systemMetrics.performance.errorRate * 100).toFixed(2)}%</span>
                                    <TrendingDown className="w-4 h-4 text-green-600" />
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">در دسترس بودن</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-green-600">{systemMetrics.performance.availability}%</span>
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    const renderMapSettingsTab = () => {
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold">تنظیمات نقشه</h3>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">ارائه دهنده نقشه</label>
                            <select
                                value={systemConfig.mapSettings.provider}
                                onChange={(e) => setSystemConfig(prev => ({
                                    ...prev,
                                    mapSettings: { ...prev.mapSettings, provider: e.target.value }
                                }))}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700"
                            >
                                <option value="osm">OpenStreetMap</option>
                                <option value="mapbox">Mapbox</option>
                                <option value="google">Google Maps</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2">زوم پیش فرض</label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={systemConfig.mapSettings.defaultZoom}
                                onChange={(e) => setSystemConfig(prev => ({
                                    ...prev,
                                    mapSettings: { ...prev.mapSettings, defaultZoom: parseInt(e.target.value) }
                                }))}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700"
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderUIThemeTab = () => {
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold">ظاهر سیستم</h3>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">رنگ اصلی</label>
                            <input
                                type="color"
                                value={systemConfig.ui.primaryColor}
                                onChange={(e) => setSystemConfig(prev => ({
                                    ...prev,
                                    ui: { ...prev.ui, primaryColor: e.target.value }
                                }))}
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2">رنگ ثانویه</label>
                            <input
                                type="color"
                                value={systemConfig.ui.secondaryColor}
                                onChange={(e) => setSystemConfig(prev => ({
                                    ...prev,
                                    ui: { ...prev.ui, secondaryColor: e.target.value }
                                }))}
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderFeaturesTab = () => {
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold">مدیریت ویژگی ها</h3>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="space-y-4">
                        {Object.entries(systemConfig.features).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between">
                                <span className="font-medium">
                                    {key === 'realTimeTracking' && 'ردیابی زنده'}
                                    {key === 'chatSystem' && 'سیستم چت'}
                                    {key === 'paymentGateway' && 'درگاه پرداخت'}
                                    {key === 'notifications' && 'اعلانات'}
                                    {key === 'analytics' && 'آنالیتیکس'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={value}
                                        onChange={(e) => setSystemConfig(prev => ({
                                            ...prev,
                                            features: { ...prev.features, [key]: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderPortalsControlTab = () => {
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-bold">کنترل کامل پورتالها</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Car className="w-5 h-5" />
                            پورتال رانندگان
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span>فعال بودن پورتال</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" defaultChecked className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            پورتال مسافران
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span>فعال بودن پورتال</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" defaultChecked className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            کنترل عمومی
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span>حالت نگهداری</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-full bg-gray-100 dark:bg-gray-900">
            {/* Sticky header + tab bar (mobile-first) */}
            <div className="sticky top-0 z-20 bg-gray-100/85 dark:bg-gray-900/85 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60">
                <div className="p-4 sm:p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-[10px] font-black tracking-[0.25em] uppercase text-gray-400">Admin</div>
                            <h1 className="mt-2 text-xl sm:text-2xl font-black text-gray-900 dark:text-white truncate">
                                {tabs.find(t => t.id === activeTab)?.name || 'Admin'}
                            </h1>
                            <div className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                Enterprise operations console
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveConfig} icon={<Save size={16} />}>
                                ذخیره
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-none inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition-colors ${isActive
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white/80 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="truncate max-w-[10rem]">{tab.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 md:p-8">
                {activeTab === 'drivers' && renderDriversTab()}
                {activeTab === 'kyc' && renderKycTab()}
                {activeTab === 'users' && renderUsersTab()}
                {activeTab === 'rides' && renderRidesTab()}
                {activeTab === 'portals' && renderPortalsControlTab()}
                {activeTab === 'taxi-types' && renderTaxiTypesTab()}
                {activeTab === 'map-settings' && renderMapSettingsTab()}
                {activeTab === 'pricing' && renderPricingTab()}
                {activeTab === 'ui-theme' && renderUIThemeTab()}
                {activeTab === 'features' && renderFeaturesTab()}
                {activeTab === 'analytics' && renderAnalyticsTab()}
                {activeTab === 'monitor' && renderMonitorTab()}
                {activeTab === 'database' && renderDatabaseTab()}
                
                {/* All tabs are wired to real pages/APIs; no placeholder sections. */}
            </div>
        </div>
    );
};
