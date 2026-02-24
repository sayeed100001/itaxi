import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CheckCircle, XCircle, Clock, TrendingUp, Users, DollarSign, Award } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../../store';

type CreditRequest = {
  id: string;
  driverId: string;
  packageName: string;
  credits: number;
  amountAfn: number;
  months: number;
  paymentMethod: string;
  paymentReference?: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  driver: {
    user: { name: string; phone: string };
  };
};

type MonthlyRevenue = {
  month: string;
  totalRevenue: number;
  creditSales: number;
  requestCount: number;
};

type TopDriver = {
  driverId: string;
  name: string;
  phone: string;
  totalTrips: number;
  rating: number;
  earnings: number;
  creditBalance: number;
  status: string;
};

type TopRider = {
  riderId: string;
  name: string;
  phone: string;
  totalTrips: number;
  totalSpent: number;
};

export const AdminCreditPurchasePage: React.FC = () => {
  const addToast = useAppStore((state) => state.addToast);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<CreditRequest[]>([]);
  const [allRequests, setAllRequests] = useState<CreditRequest[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [topDrivers, setTopDrivers] = useState<TopDriver[]>([]);
  const [topRiders, setTopRiders] = useState<TopRider[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [pending, all, revenue, drivers, riders] = await Promise.all([
        fetch('/api/admin/driver-credits/purchase-requests?status=PENDING', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch('/api/admin/driver-credits/purchase-requests', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch('/api/admin/driver-credits/stats/monthly-revenue?months=12', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch('/api/admin/driver-credits/stats/top-drivers?limit=10&period=month', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()),
        fetch('/api/admin/driver-credits/stats/top-riders?limit=10&period=month', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json())
      ]);

      if (pending.success) setPendingRequests(pending.data);
      if (all.success) setAllRequests(all.data);
      if (revenue.success) setMonthlyRevenue(revenue.data);
      if (drivers.success) setTopDrivers(drivers.data);
      if (riders.success) setTopRiders(riders.data);
    } catch (error: any) {
      addToast('error', error?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/driver-credits/purchase-requests/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reviewNotes })
      });

      const data = await response.json();
      if (data.success) {
        addToast('success', 'Credit request approved successfully');
        setSelectedRequest(null);
        setReviewNotes('');
        loadData();
      } else {
        addToast('error', data.message || 'Failed to approve request');
      }
    } catch (error) {
      addToast('error', 'Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/driver-credits/purchase-requests/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reviewNotes })
      });

      const data = await response.json();
      if (data.success) {
        addToast('success', 'Credit request rejected');
        setSelectedRequest(null);
        setReviewNotes('');
        loadData();
      } else {
        addToast('error', data.message || 'Failed to reject request');
      }
    } catch (error) {
      addToast('error', 'Failed to reject request');
    } finally {
      setProcessing(false);
    }
  };

  const totalPendingAmount = pendingRequests.reduce((sum, r) => sum + r.amountAfn, 0);
  const totalApprovedAmount = allRequests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + r.amountAfn, 0);
  const totalRevenue = monthlyRevenue.reduce((sum, m) => sum + m.totalRevenue, 0);

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-dark-900 dark:text-white">Credit Purchase Management</h1>
        <p className="text-dark-500 dark:text-dark-400">Offline credit sales, approvals, and revenue tracking</p>
      </header>

      {loading ? (
        <Card className="p-6 text-dark-500">Loading...</Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-dark-500 mb-1">Pending Requests</div>
                  <div className="text-3xl font-black text-orange-500">{pendingRequests.length}</div>
                  <div className="text-xs text-dark-500 mt-1">؋{totalPendingAmount.toLocaleString()}</div>
                </div>
                <Clock size={32} className="text-orange-500" />
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-dark-500 mb-1">Total Revenue (12m)</div>
                  <div className="text-3xl font-black text-green-600">؋{totalRevenue.toLocaleString()}</div>
                  <div className="text-xs text-dark-500 mt-1">Credit sales only</div>
                </div>
                <DollarSign size={32} className="text-green-600" />
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-dark-500 mb-1">Approved (All Time)</div>
                  <div className="text-3xl font-black text-blue-600">؋{totalApprovedAmount.toLocaleString()}</div>
                  <div className="text-xs text-dark-500 mt-1">{allRequests.filter(r => r.status === 'APPROVED').length} requests</div>
                </div>
                <CheckCircle size={32} className="text-blue-600" />
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-dark-500 mb-1">Top Drivers</div>
                  <div className="text-3xl font-black text-purple-600">{topDrivers.length}</div>
                  <div className="text-xs text-dark-500 mt-1">This month</div>
                </div>
                <Award size={32} className="text-purple-600" />
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Card>
              <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Monthly Revenue Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
                    <Line type="monotone" dataKey="totalRevenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Monthly Requests</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
                    <Bar dataKey="requestCount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Pending Requests */}
          <Card className="mb-8">
            <div className="p-4 border-b border-dark-100 dark:border-white/5">
              <h3 className="font-bold text-lg text-dark-900 dark:text-white flex items-center gap-2">
                <Clock size={20} className="text-orange-500" /> Pending Credit Requests
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-dark-100 dark:border-white/5 bg-dark-50 dark:bg-white/5">
                  <tr className="text-xs font-bold text-dark-400 uppercase">
                    <th className="p-4 text-left">Driver</th>
                    <th className="p-4 text-left">Package</th>
                    <th className="p-4 text-left">Credits</th>
                    <th className="p-4 text-left">Amount</th>
                    <th className="p-4 text-left">Payment</th>
                    <th className="p-4 text-left">Requested</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-100 dark:divide-white/5">
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-dark-50 dark:hover:bg-white/5">
                      <td className="p-4">
                        <div className="font-bold text-dark-900 dark:text-white">{req.driver.user.name}</div>
                        <div className="text-xs text-dark-500">{req.driver.user.phone}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-dark-900 dark:text-white">{req.packageName}</div>
                        <div className="text-xs text-dark-500">{req.months} month(s)</div>
                      </td>
                      <td className="p-4 font-bold text-brand-600 dark:text-brand-400">{req.credits}</td>
                      <td className="p-4 font-bold text-dark-900 dark:text-white">؋{req.amountAfn.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="text-xs font-bold text-dark-900 dark:text-white">{req.paymentMethod}</div>
                        {req.paymentReference && <div className="text-xs text-dark-500 font-mono">{req.paymentReference}</div>}
                      </td>
                      <td className="p-4 text-xs text-dark-500">{new Date(req.requestedAt).toLocaleString()}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setSelectedRequest(req)}
                          >
                            Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingRequests.length === 0 && (
                <div className="p-12 text-center text-dark-500">No pending requests</div>
              )}
            </div>
          </Card>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <div className="p-4 border-b border-dark-100 dark:border-white/5">
                <h3 className="font-bold text-lg text-dark-900 dark:text-white flex items-center gap-2">
                  <TrendingUp size={20} className="text-purple-500" /> Top Earning Drivers (This Month)
                </h3>
              </div>
              <div className="divide-y divide-dark-100 dark:divide-white/5">
                {topDrivers.map((driver, idx) => (
                  <div key={driver.driverId} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center font-bold text-purple-600 dark:text-purple-400">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-dark-900 dark:text-white">{driver.name}</div>
                        <div className="text-xs text-dark-500">{driver.totalTrips} trips • {driver.rating.toFixed(1)}★</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-dark-900 dark:text-white">؋{driver.earnings.toLocaleString()}</div>
                      <div className="text-xs text-dark-500">{driver.creditBalance} credits</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-dark-100 dark:border-white/5">
                <h3 className="font-bold text-lg text-dark-900 dark:text-white flex items-center gap-2">
                  <Users size={20} className="text-blue-500" /> Top Spending Riders (This Month)
                </h3>
              </div>
              <div className="divide-y divide-dark-100 dark:divide-white/5">
                {topRiders.map((rider, idx) => (
                  <div key={rider.riderId} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-dark-900 dark:text-white">{rider.name}</div>
                        <div className="text-xs text-dark-500">{rider.totalTrips} trips</div>
                      </div>
                    </div>
                    <div className="font-bold text-dark-900 dark:text-white">؋{rider.totalSpent.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-2xl bg-white dark:bg-dark-900 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-100 dark:border-white/5">
              <h2 className="text-xl font-bold text-dark-900 dark:text-white">Review Credit Request</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-dark-400 mb-1">Driver</div>
                  <div className="font-bold text-dark-900 dark:text-white">{selectedRequest.driver.user.name}</div>
                  <div className="text-xs text-dark-500">{selectedRequest.driver.user.phone}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-dark-400 mb-1">Package</div>
                  <div className="font-bold text-dark-900 dark:text-white">{selectedRequest.packageName}</div>
                  <div className="text-xs text-dark-500">{selectedRequest.months} month(s)</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-dark-400 mb-1">Credits</div>
                  <div className="text-2xl font-black text-brand-600 dark:text-brand-400">{selectedRequest.credits}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-dark-400 mb-1">Amount</div>
                  <div className="text-2xl font-black text-green-600">؋{selectedRequest.amountAfn.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-dark-400 mb-1">Payment Method</div>
                  <div className="font-bold text-dark-900 dark:text-white">{selectedRequest.paymentMethod}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-dark-400 mb-1">Reference</div>
                  <div className="font-mono text-sm text-dark-900 dark:text-white">{selectedRequest.paymentReference || 'N/A'}</div>
                </div>
              </div>
              {selectedRequest.notes && (
                <div>
                  <div className="text-xs font-bold text-dark-400 mb-1">Driver Notes</div>
                  <div className="p-3 bg-dark-50 dark:bg-white/5 rounded-lg text-sm text-dark-900 dark:text-white">{selectedRequest.notes}</div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-dark-400 mb-1 block">Admin Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-lg text-sm"
                  rows={3}
                  placeholder="Add notes about payment verification..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-dark-100 dark:border-white/5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSelectedRequest(null)} disabled={processing}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => handleReject(selectedRequest.id)}
                disabled={processing}
              >
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleApprove(selectedRequest.id)}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Approve & Add Credits'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
