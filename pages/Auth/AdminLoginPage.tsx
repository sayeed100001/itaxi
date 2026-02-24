import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAppStore } from '../../store';
import { Shield, Mail, Lock, ArrowLeft } from 'lucide-react';

import { API_BASE } from '../../config';

export const AdminLoginPage: React.FC = () => {
    const { setUser, setAppMode, setRole, addToast } = useAppStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${API_BASE}/auth/admin-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.data.token);
                setRole('ADMIN');
                setUser({
                    id: data.data.user.id,
                    name: data.data.user.name,
                    email: data.data.user.email,
                    phone: data.data.user.phone,
                    role: 'ADMIN',
                    rating: 5.0
                });
                setAppMode('app');
                addToast('success', 'Admin login successful');
            } else {
                const message = data.message || 'Invalid email or password.';
                setError(message);
                addToast('error', message);
            }
        } catch (error) {
            const message = 'Unable to reach admin server. Please try again.';
            setError(message);
            addToast('error', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-slate-950">
            <button 
                onClick={() => window.location.hash = ''}
                className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors z-20"
            >
                <ArrowLeft size={20} /> Back
            </button>

            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            <Card className="w-full max-w-md mx-4 border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                        <Shield className="text-white" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Admin Portal
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Secure access for administrators only
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                            <input 
                                type="email"
                                placeholder="admin@itaxi.com"
                                className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-11 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                            <input 
                                type="password"
                                placeholder="••••••••"
                                className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-11 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mt-3 text-sm rounded-xl border border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-100 px-3 py-2">
                            {error}
                        </div>
                    )}

                    <Button 
                        type="submit" 
                        size="lg" 
                        isLoading={loading} 
                        className="w-full mt-6 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                    >
                        <Shield size={18} /> Login to Admin Panel
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Protected by enterprise-grade security
                    </p>
                </div>
            </Card>
        </div>
    );
};
