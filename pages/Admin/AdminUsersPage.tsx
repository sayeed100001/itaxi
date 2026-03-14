
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Filter, Star, Phone, Mail, MapPin, Calendar, TrendingUp, Award, Ban, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { apiFetch } from '../../services/api';

export const AdminUsersPage: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<'all' | 'rider' | 'driver'>('all');
    const addToast = useAppStore((state) => state.addToast);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await apiFetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleBanUser = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        try {
            const res = await apiFetch(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                addToast(newStatus === 'suspended' ? 'error' : 'success', `User ${newStatus === 'suspended' ? 'Suspended' : 'Activated'}`);
                fetchUsers();
            }
        } catch (e) {
            addToast('error', 'Failed to update status');
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              u.phone.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterRole === 'all' || u.role === filterRole;
        return matchesSearch && matchesFilter;
    });

    const totalUsers = users.length;
    const totalRiders = users.filter(u => u.role === 'rider').length;
    const totalDrivers = users.filter(u => u.role === 'driver').length;
    const avgRating = (users.reduce((acc, u) => acc + (parseFloat(u.rating) || 0), 0) / (totalUsers || 1)).toFixed(1);

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-dark-50 dark:bg-dark-950">
            <header className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-dark-900 dark:text-white">Users Management</h1>
                <p className="text-dark-500 dark:text-dark-400">Manage riders and drivers accounts.</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Total Users</div>
                        <div className="text-3xl font-black text-dark-900 dark:text-white">{totalUsers}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                        <TrendingUp size={24}/>
                    </div>
                </Card>
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Riders</div>
                        <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{totalRiders}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <MapPin size={24}/>
                    </div>
                </Card>
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Drivers</div>
                        <div className="text-3xl font-black text-green-600 dark:text-green-400">{totalDrivers}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                        <Award size={24}/>
                    </div>
                </Card>
                <Card className="flex items-center justify-between">
                    <div>
                        <div className="text-dark-400 text-xs font-bold uppercase mb-2">Avg Rating</div>
                        <div className="text-3xl font-black text-yellow-500">{avgRating}</div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                        <Star size={24}/>
                    </div>
                </Card>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-dark-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by name or phone..." 
                        className="w-full pl-12 pr-4 py-2.5 sm:py-3 rounded-2xl bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 focus:ring-2 focus:ring-brand-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    {['all', 'rider', 'driver'].map(role => (
                        <button
                            key={role}
                            onClick={() => setFilterRole(role as any)}
                            className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold capitalize whitespace-nowrap ${filterRole === role ? 'bg-brand-500 text-white' : 'bg-white dark:bg-dark-900 text-dark-500 border border-dark-200 dark:border-white/10'}`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile List */}
            <div className="space-y-3 lg:hidden">
                {filteredUsers.map((user) => {
                    const rating = Number.parseFloat(user.rating || 0) || 0;
                    const balance = Number.parseFloat(user.balance || 0) || 0;

                    return (
                        <Card key={user.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-dark-100 dark:bg-dark-800 overflow-hidden shrink-0">
                                        <img src={`https://ui-avatars.com/api/?name=${user.name}&background=random`} alt={user.name} className="w-full h-full object-cover"/>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-dark-900 dark:text-white truncate">{user.name}</div>
                                        <div className="text-xs text-dark-500 flex items-center gap-1.5 mt-0.5">
                                            <Phone size={12}/> <span className="font-mono">{user.phone}</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleBanUser(user.id, user.status || 'active')}
                                    className={`p-2.5 rounded-xl border transition-all ${user.status === 'suspended' 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20' 
                                        : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/20'
                                    }`}
                                    aria-label={user.status === 'suspended' ? 'Activate user' : 'Suspend user'}
                                >
                                    {user.status === 'suspended' ? <CheckCircle size={16} /> : <Ban size={16} />}
                                </button>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${user.role === 'rider' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : user.role === 'driver' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                                    {user.role}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-dark-700 dark:text-dark-300">
                                    <Star size={14} className="fill-yellow-400 text-yellow-400" /> {rating.toFixed(1)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs text-dark-500">
                                    <Calendar size={14} /> {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-dark-50 dark:bg-white/[0.03] border border-dark-100 dark:border-white/5 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Trips</div>
                                    <div className="mt-1 font-mono font-black text-dark-900 dark:text-white">{user.total_trips || 0}</div>
                                </div>
                                <div className="rounded-xl bg-dark-50 dark:bg-white/[0.03] border border-dark-100 dark:border-white/5 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Balance</div>
                                    <div className="mt-1 font-mono font-black text-dark-900 dark:text-white">؋{balance.toLocaleString()}</div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
                {filteredUsers.length === 0 && (
                    <Card className="p-8 text-center text-dark-500">No users found.</Card>
                )}
            </div>

            {/* Desktop Table */}
            <Card className="overflow-hidden hidden lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-dark-100 dark:border-white/5 text-xs font-bold text-dark-400 uppercase bg-dark-50/50 dark:bg-white/[0.02]">
                                <th className="p-5">User</th>
                                <th className="p-5">Role</th>
                                <th className="p-5">Rating</th>
                                <th className="p-5">Total Trips</th>
                                <th className="p-5">Balance</th>
                                <th className="p-5">Joined</th>
                                <th className="p-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-dark-50/50 dark:hover:bg-white/[0.02] group">
                                    <td className="p-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-dark-100 dark:bg-dark-800 overflow-hidden">
                                                <img src={`https://ui-avatars.com/api/?name=${user.name}&background=random`} alt={user.name} className="w-full h-full object-cover"/>
                                            </div>
                                            <div>
                                                <div className="font-bold text-dark-900 dark:text-white">{user.name}</div>
                                                <div className="text-xs text-dark-500 flex items-center gap-1.5"><Phone size={12}/> {user.phone}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold capitalize ${user.role === 'rider' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : user.role === 'driver' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-1.5">
                                            <Star size={16} className="fill-yellow-400 text-yellow-400" />
                                            <span className="font-bold">{parseFloat(user.rating || 0).toFixed(1)}</span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className="font-mono font-bold">{user.total_trips || 0}</span>
                                    </td>
                                    <td className="p-5">
                                        <span className="font-mono font-bold">؋{parseFloat(user.balance || 0).toLocaleString()}</span>
                                    </td>
                                    <td className="p-5">
                                        <div className="text-sm text-dark-500 flex items-center gap-1.5">
                                            <Calendar size={14}/>
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <button 
                                            onClick={() => handleBanUser(user.id, user.status || 'active')}
                                            className={`p-2.5 rounded-xl border transition-all ${user.status === 'suspended' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}
                                        >
                                            {user.status === 'suspended' ? <CheckCircle size={16} /> : <Ban size={16} />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-dark-500">No users found.</div>
                )}
            </Card>
        </div>
    );
};
