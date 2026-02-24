import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store';

type AnalyticsPayload = {
  kpis: {
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    activeDrivers: number;
    completionRate: number;
    cancellationRate: number;
    avgFare: number;
    avgDurationMinutes: number;
    sosLast24h: number;
  };
  hourlyDemand: Array<{ hour: string; rides: number; revenue: number }>;
  serviceDistribution: Array<{ serviceType: string; count: number }>;
  generatedAt: string;
};

const PIE_COLORS = ['#3b82f6', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#a855f7'];

export const AdminAnalyticsPage: React.FC = () => {
  const addToast = useAppStore((state) => state.addToast);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/insights/analytics', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.message || 'Failed to load analytics');
        }

        setPayload(data.data);
      } catch (error: any) {
        addToast('error', error?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [addToast]);

  const kpiCards = useMemo(() => {
    if (!payload) return [];

    return [
      { label: 'Active Drivers', value: payload.kpis.activeDrivers.toString(), icon: Users, color: 'text-blue-500' },
      { label: 'Avg Trip Time', value: `${payload.kpis.avgDurationMinutes} min`, icon: Clock, color: 'text-purple-500' },
      { label: 'Completion Rate', value: `${payload.kpis.completionRate}%`, icon: TrendingUp, color: 'text-green-500' },
      { label: 'SOS (24h)', value: payload.kpis.sosLast24h.toString(), icon: AlertTriangle, color: 'text-red-500' },
    ];
  }, [payload]);

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 transition-colors duration-300 pb-24">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-dark-900 dark:text-white tracking-tight">Analytics & Reports</h1>
        <p className="text-dark-500 dark:text-dark-400">Live operational metrics from production database.</p>
      </header>

      {loading ? (
        <Card className="p-6 text-dark-500">Loading analytics...</Card>
      ) : !payload ? (
        <Card className="p-6 text-red-500">Analytics data is unavailable.</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpiCards.map((kpi) => (
              <Card key={kpi.label} className="flex items-center gap-4 p-5">
                <div className={`w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm ${kpi.color}`}>
                  <kpi.icon size={24} />
                </div>
                <div>
                  <div className="text-dark-500 text-xs font-bold uppercase tracking-wider">{kpi.label}</div>
                  <div className="text-2xl font-black text-dark-900 dark:text-white">{kpi.value}</div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <Card className="lg:col-span-2">
              <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Demand vs Revenue (last 24h)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={payload.hourlyDemand}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
                    <Line yAxisId="left" type="monotone" dataKey="rides" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Trips By Service</h3>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payload.serviceDistribution}
                      dataKey="count"
                      nameKey="serviceType"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {payload.serviceDistribution.map((entry, idx) => (
                        <Cell key={entry.serviceType} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Hourly Ride Count</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payload.hourlyDemand}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
                  <Bar dataKey="rides" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-xs text-dark-500">Last updated: {new Date(payload.generatedAt).toLocaleString()}</div>
          </Card>
        </>
      )}
    </div>
  );
};
