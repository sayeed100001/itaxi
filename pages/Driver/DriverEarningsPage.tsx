import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TrendingUp, DollarSign, Calendar, Star, Clock, MapPin, Award, Target } from 'lucide-react';
import { API_BASE } from '../../config';
import { useAppStore } from '../../store';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EarningsSummary {
    today: { earnings: number; trips: number };
    week: { earnings: number; trips: number };
    month: { earnings: number; trips: number };
    total: { earnings: number; trips: number };
    rating: { average: number; count: number };
}

interface PerformanceMetrics {
    completionRate: number;
    avgTripDuration: number;
    avgTripDistance: number;
    peakHours: Array<{ hour: number; trips: number }>;
}

export const DriverEarningsPage: React.FC = () => {
    const { addToast } = useAppStore();
    const [summary, setSummary] = useState<EarningsSummary | null>(null);
    const [dailyData, setDailyData] = useState<Array<{ date: string; earnings: number; trips: number }>>([]);
    const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [summaryRes, dailyRes, performanceRes] = await Promise.all([
                fetch(`${API_BASE}/drivers/earnings/summary`, { headers }),
                fetch(`${API_BASE}/drivers/earnings/daily`, { headers }),
                fetch(`${API_BASE}/drivers/earnings/performance`, { headers }),
            ]);

            const [summaryData, dailyDataRes, performanceData] = await Promise.all([
                summaryRes.json(),
                dailyRes.json(),
                performanceRes.json(),
            ]);

            if (summaryData.success) setSummary(summaryData.data);
            if (dailyDataRes.success) setDailyData(dailyDataRes.data);
            if (performanceData.success) setPerformance(performanceData.data);
        } catch (error) {
            addToast('error', 'Failed to load earnings data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-dark-500">Loading earnings...</div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white">My Earnings</h1>
                <p className="text-dark-500 dark:text-dark-400">Track your performance and income</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="p-5 bg-gradient-to-br from-green-500 to-green-600 text-white border-transparent">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Today (80%)</div>
                            <div className="text-3xl font-black">؋{summary?.today.earnings || 0}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <div className="text-xs opacity-80">{summary?.today.trips || 0} trips • 20% platform fee deducted</div>
                </Card>

                <Card className="p-5 bg-white dark:bg-white/5 border-transparent">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-dark-500 mb-1">This Week (80%)</div>
                            <div className="text-3xl font-black text-dark-900 dark:text-white">؋{summary?.week.earnings || 0}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <div className="text-xs text-dark-500">{summary?.week.trips || 0} trips</div>
                </Card>

                <Card className="p-5 bg-white dark:bg-white/5 border-transparent">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-dark-500 mb-1">This Month (80%)</div>
                            <div className="text-3xl font-black text-dark-900 dark:text-white">؋{summary?.month.earnings || 0}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="text-xs text-dark-500">{summary?.month.trips || 0} trips</div>
                </Card>

                <Card className="p-5 bg-white dark:bg-white/5 border-transparent">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-dark-500 mb-1">Rating</div>
                            <div className="text-3xl font-black text-yellow-500">{summary?.rating.average.toFixed(1) || '0.0'}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                            <Star size={20} />
                        </div>
                    </div>
                    <div className="text-xs text-dark-500">{summary?.rating.count || 0} ratings</div>
                </Card>
            </div>

            {/* Commission Info Banner */}
            <Card className="mb-8 p-4 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-1">Commission Model: 80% Driver / 20% Platform</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            When you accept a trip, 20% of the rider's suggested fare is deducted from your credit balance as platform commission. 
                            Upon trip completion, you receive 80% of the fare as your earnings. All earnings shown above are your net income (80% share).
                        </p>
                    </div>
                </div>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card className="p-6 bg-white dark:bg-dark-900 border-dark-200 dark:border-white/5">
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-4">Daily Earnings (Last 30 Days)</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#888" />
                            <YAxis tick={{ fontSize: 12 }} stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                            <Line type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>

                <Card className="p-6 bg-white dark:bg-dark-900 border-dark-200 dark:border-white/5">
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-4">Peak Hours</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={performance?.peakHours || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                            <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="#888" />
                            <YAxis tick={{ fontSize: 12 }} stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                            <Bar dataKey="trips" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-white dark:bg-white/5 border-transparent">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center">
                            <Target size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-dark-500 uppercase tracking-wider">Completion Rate</div>
                            <div className="text-2xl font-black text-dark-900 dark:text-white">{performance?.completionRate.toFixed(1) || 0}%</div>
                        </div>
                    </div>
                    <div className="w-full bg-dark-100 dark:bg-white/10 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${performance?.completionRate || 0}%` }}></div>
                    </div>
                </Card>

                <Card className="p-6 bg-white dark:bg-white/5 border-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Clock size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-dark-500 uppercase tracking-wider">Avg Trip Duration</div>
                            <div className="text-2xl font-black text-dark-900 dark:text-white">{performance?.avgTripDuration.toFixed(0) || 0} min</div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-white dark:bg-white/5 border-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <MapPin size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-dark-500 uppercase tracking-wider">Avg Distance</div>
                            <div className="text-2xl font-black text-dark-900 dark:text-white">{performance?.avgTripDistance.toFixed(1) || 0} km</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Total Earnings Summary */}
            <Card className="mt-8 p-8 bg-gradient-to-br from-brand-500 to-blue-600 text-white border-transparent">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-bold uppercase tracking-wider opacity-80 mb-2">Total Lifetime Earnings</div>
                        <div className="text-5xl font-black mb-2">؋{summary?.total.earnings.toLocaleString() || 0}</div>
                        <div className="text-sm opacity-80">{summary?.total.trips || 0} completed trips</div>
                    </div>
                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                        <Award size={40} />
                    </div>
                </div>
            </Card>
        </div>
    );
};
