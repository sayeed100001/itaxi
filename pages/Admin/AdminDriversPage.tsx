import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Filter, Star, Car, Phone, CheckCircle, XCircle, Ban, Edit2, FileText } from 'lucide-react';
import { API_BASE } from '../../config';

interface Driver {
    id: string;
    userId: string;
    name: string;
    phone: string;
    email?: string;
    city: string;
    province: string;
    status: string;
    vehicleType: string;
    plateNumber: string;
    baseFare: number;
    perKmRate: number;
    credits: number;
    creditsExpiry?: Date;
    totalTrips: number;
    completedTrips: number;
    totalEarnings: number;
    rating: number;
    ratingCount: number;
    location?: { lat: number; lng: number; updatedAt: Date } | null;
}

export const AdminDriversPage: React.FC = () => {
    const { addToast } = useAppStore();
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'ONLINE' | 'OFFLINE' | 'SUSPENDED'>('all');
    const [filterCity, setFilterCity] = useState<string>('all');
    const [filterProvince, setFilterProvince] = useState<string>('all');
    const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Driver>>({});
    const [creditAmount, setCreditAmount] = useState<string>('');
    const [creditReason, setCreditReason] = useState<string>('');
    const [isCreditProcessing, setIsCreditProcessing] = useState(false);

    useEffect(() => {
        fetchDrivers();
    }, [filterCity, filterProvince, filterStatus]);

    const fetchDrivers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterCity !== 'all') params.append('city', filterCity);
            if (filterProvince !== 'all') params.append('province', filterProvince);
            if (filterStatus !== 'all') params.append('status', filterStatus);
            if (searchTerm) params.append('search', searchTerm);

            const response = await fetch(`${API_BASE}/admin/drivers?${params}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });

            const data = await response.json();
            if (data.success) {
                setDrivers(data.data);
            } else {
                addToast('error', data.message || 'Failed to fetch drivers');
            }
        } catch (error) {
            addToast('error', 'Failed to fetch drivers');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (driver: Driver) => {
        setSelectedDriver(driver);
        setEditForm({ ...driver });
        setCreditAmount('');
        setCreditReason('');
        setIsEditModalOpen(true);
    };

    const handleSaveDriver = async () => {
        if (selectedDriver && editForm) {
            try {
                const response = await fetch(`${API_BASE}/admin/drivers/${selectedDriver.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify(editForm),
                });

                const data = await response.json();
                if (data.success) {
                    addToast('success', 'Driver updated successfully');
                    setIsEditModalOpen(false);
                    fetchDrivers();
                } else {
                    addToast('error', data.message || 'Failed to update driver');
                }
            } catch (error) {
                addToast('error', 'Failed to update driver');
            }
        }
    };

    const handleBanDriver = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'SUSPENDED' ? 'OFFLINE' : 'SUSPENDED';
        try {
            const response = await fetch(`${API_BASE}/admin/drivers/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });

            const data = await response.json();
            if (data.success) {
                addToast(newStatus === 'SUSPENDED' ? 'error' : 'success', data.message);
                fetchDrivers();
            } else {
                addToast('error', data.message || 'Failed to update status');
            }
        } catch (error) {
            addToast('error', 'Failed to update status');
        }
    };

    const handleManageCredits = async (action: 'add' | 'deduct') => {
        if (!selectedDriver || !creditAmount || isNaN(Number(creditAmount)) || Number(creditAmount) <= 0) {
            addToast('error', 'Please enter a valid amount');
            return;
        }

        setIsCreditProcessing(true);
        try {
            const response = await fetch(`${API_BASE}/admin/driver-credits/driver/${selectedDriver.id}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    amount: Number(creditAmount),
                    reason: creditReason || `Admin manual ${action}`
                })
            });

            const data = await response.json();
            if (data.success) {
                setDrivers(prev => prev.map(d => d.id === selectedDriver.id ? { ...d, credits: data.data.newBalance } : d));
                setEditForm(prev => ({ ...prev, credits: data.data.newBalance }));
                setSelectedDriver(prev => prev ? { ...prev, credits: data.data.newBalance } : null);
                addToast('success', `Credits ${action}ed successfully`);
                setCreditAmount('');
                setCreditReason('');
            } else {
                addToast('error', data.message || `Failed to ${action} credits`);
            }
        } catch (error) {
            addToast('error', `Failed to ${action} credits`);
        } finally {
            setIsCreditProcessing(false);
        }
    };

    const filteredDrivers = drivers.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.vehicleType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.plateNumber && d.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const cities = Array.from(new Set(drivers.map(d => d.city).filter(Boolean)));
    const provinces = Array.from(new Set(drivers.map(d => d.province).filter(Boolean)));

    const totalDrivers = drivers.length;
    const onlineDrivers = drivers.filter(d => d.status === 'ONLINE').length;
    const suspendedDrivers = drivers.filter(d => d.status === 'SUSPENDED').length;
    const avgRating = drivers.length > 0 ? (drivers.reduce((acc, d) => acc + d.rating, 0) / totalDrivers).toFixed(1) : '0.0';

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 transition-colors duration-300 pb-24">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-dark-900 dark:text-white">Driver Management</h1>
                    <p className="text-dark-500 dark:text-dark-400">Monitor drivers by city and province</p>
                </div>
                <Button icon={<Car size={16} />} onClick={fetchDrivers}>Refresh</Button>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="p-5 flex items-center justify-between bg-white dark:bg-white/5 border-transparent shadow-sm">
                    <div>
                        <div className="text-dark-500 text-xs font-bold uppercase tracking-wider mb-1">Total Fleet</div>
                        <div className="text-3xl font-black text-dark-900 dark:text-white">{totalDrivers}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center"><Car size={20} /></div>
                </Card>
                <Card className="p-5 flex items-center justify-between bg-white dark:bg-white/5 border-transparent shadow-sm">
                    <div>
                        <div className="text-dark-500 text-xs font-bold uppercase tracking-wider mb-1">Online Now</div>
                        <div className="text-3xl font-black text-green-600 dark:text-green-400">{onlineDrivers}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center"><CheckCircle size={20} /></div>
                </Card>
                <Card className="p-5 flex items-center justify-between bg-white dark:bg-white/5 border-transparent shadow-sm">
                    <div>
                        <div className="text-dark-500 text-xs font-bold uppercase tracking-wider mb-1">Avg Rating</div>
                        <div className="text-3xl font-black text-yellow-500">{avgRating}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center"><Star size={20} /></div>
                </Card>
                <Card className="p-5 flex items-center justify-between bg-white dark:bg-white/5 border-transparent shadow-sm">
                    <div>
                        <div className="text-dark-500 text-xs font-bold uppercase tracking-wider mb-1">Suspended</div>
                        <div className="text-3xl font-black text-red-500">{suspendedDrivers}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center"><Ban size={20} /></div>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-dark-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search drivers..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 focus:ring-2 focus:ring-brand-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select value={filterProvince} onChange={(e) => setFilterProvince(e.target.value)} className="px-4 py-2 rounded-lg bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-sm font-bold">
                    <option value="all">All Provinces</option>
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="px-4 py-2 rounded-lg bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-sm font-bold">
                    <option value="all">All Cities</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex gap-2">
                    {['all', 'ONLINE', 'OFFLINE', 'SUSPENDED'].map(status => (
                        <button key={status} onClick={() => setFilterStatus(status as any)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize ${filterStatus === status ? 'bg-brand-600 text-white' : 'bg-white dark:bg-white/5 text-dark-500'}`}>
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Drivers Table */}
            <div className="bg-white dark:bg-dark-900 rounded-2xl shadow-sm border border-dark-200 dark:border-white/5 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-dark-100 dark:border-white/5 text-xs font-bold text-dark-400 uppercase bg-dark-50 dark:bg-white/5">
                            <th className="p-4">Driver</th>
                            <th className="p-4">Location</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Vehicle</th>
                            <th className="p-4">Rating</th>
                            <th className="p-4">Earnings</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                        {loading ? (
                            <tr><td colSpan={7} className="p-12 text-center text-dark-500">Loading...</td></tr>
                        ) : filteredDrivers.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center text-dark-500">No drivers found</td></tr>
                        ) : filteredDrivers.map((driver) => (
                            <tr key={driver.id} className="hover:bg-dark-50 dark:hover:bg-white/5 group">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-dark-200 dark:bg-dark-800 overflow-hidden">
                                            <img src={`https://ui-avatars.com/api/?name=${driver.name}&background=random`} alt={driver.name} className="w-full h-full" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-dark-900 dark:text-white text-sm">{driver.name}</div>
                                            <div className="text-xs text-dark-500 flex items-center gap-1"><Phone size={10} /> {driver.phone}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-medium text-dark-900 dark:text-white">{driver.city}</div>
                                    <div className="text-xs text-dark-500">{driver.province}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${driver.status === 'ONLINE' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : driver.status === 'SUSPENDED' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : 'bg-dark-100 text-dark-600 dark:bg-white/10 dark:text-dark-400'}`}>
                                        {driver.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-medium text-dark-900 dark:text-white">{driver.vehicleType}</div>
                                    <div className="text-xs text-dark-500 font-mono">{driver.plateNumber}</div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1 text-sm font-bold text-dark-900 dark:text-white">
                                        <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                        {driver.rating.toFixed(1)}
                                    </div>
                                    <div className="text-xs text-dark-500">{driver.ratingCount} rides</div>
                                </td>
                                <td className="p-4">
                                    <div className="font-mono text-sm font-bold text-dark-900 dark:text-white">؋{driver.totalEarnings.toLocaleString()}</div>
                                    <div className="text-xs text-dark-500">{driver.completedTrips} trips</div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100">
                                        <button onClick={() => handleEditClick(driver)} className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-white/10 text-brand-600" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleBanDriver(driver.id, driver.status)} className={`p-2 rounded-lg ${driver.status === 'SUSPENDED' ? 'text-green-500' : 'text-red-500'}`} title={driver.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}>
                                            {driver.status === 'SUSPENDED' ? <CheckCircle size={16} /> : <Ban size={16} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedDriver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-2xl bg-white dark:bg-dark-900 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-dark-100 dark:border-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-dark-900 dark:text-white">Edit Driver</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-dark-400"><XCircle size={24} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-dark-400 mb-1 block">Name</label>
                                    <input type="text" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-dark-400 mb-1 block">Phone</label>
                                    <input type="text" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-dark-400 mb-1 block">Vehicle Type</label>
                                    <input type="text" value={editForm.vehicleType || ''} onChange={e => setEditForm({ ...editForm, vehicleType: e.target.value })} className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-dark-400 mb-1 block">Plate Number</label>
                                    <input type="text" value={editForm.plateNumber || ''} onChange={e => setEditForm({ ...editForm, plateNumber: e.target.value })} className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-dark-400 mb-1 block">City</label>
                                    <input type="text" value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-dark-400 mb-1 block">Province</label>
                                    <input type="text" value={editForm.province || ''} onChange={e => setEditForm({ ...editForm, province: e.target.value })} className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm" />
                                </div>
                            </div>

                            {/* Credit Management */}
                            <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-xl">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold">Current Credits</span>
                                    <span className="text-2xl font-black text-brand-600 dark:text-brand-400">{editForm.credits || 0}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <input type="number" placeholder="Amount" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} className="p-2 bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-lg text-sm" />
                                    <input type="text" placeholder="Reason" value={creditReason} onChange={e => setCreditReason(e.target.value)} className="p-2 bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-lg text-sm" />
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="secondary" className="flex-1 bg-green-100 text-green-700" onClick={() => handleManageCredits('add')} disabled={isCreditProcessing}>Add</Button>
                                    <Button variant="secondary" className="flex-1 bg-red-100 text-red-700" onClick={() => handleManageCredits('deduct')} disabled={isCreditProcessing}>Deduct</Button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-dark-100 dark:border-white/5 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveDriver}>Save</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
