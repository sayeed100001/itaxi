import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, DollarSign, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../../store';

type FinancePayload = {
  summary: {
    totalCredits: number;
    totalDebits: number;
    netCashflow: number;
    totalPayouts: number;
    pendingTransactions: number;
    pendingPayouts: number;
    transactionCount: number;
    payoutCount: number;
  };
  revenueTrend: Array<{ date: string; revenue: number; rides: number }>;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT';
    status: string;
    description: string;
    createdAt: string;
    user?: { id: string; name: string; phone: string; role: string };
  }>;
  recentPayouts: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    driver: { user: { id: string; name: string; phone: string } };
  }>;
};

export const AdminFinancePage: React.FC = () => {
  const addToast = useAppStore((state) => state.addToast);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<FinancePayload | null>(null);
  const [creditDrivers, setCreditDrivers] = useState<Array<{
    driverId: string;
    driverName: string;
    phone: string;
    creditBalance: number;
    creditExpiresAt: string | null;
    active: boolean;
    status: string;
  }>>([]);
  const [creditForm, setCreditForm] = useState({
    driverId: '',
    packageName: 'MONTHLY_STANDARD',
    credits: 120,
    months: 1,
    amountAfn: 3000,
    paymentMethod: 'CASH' as 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER',
    paymentReference: '',
    notes: '',
  });
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  useEffect(() => {
    const loadFinance = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/insights/finance', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.message || 'Failed to load finance data');
        }

        setPayload(data.data);
      } catch (error: any) {
        addToast('error', error?.message || 'Failed to load finance data');
      } finally {
        setLoading(false);
      }
    };

    loadFinance();
  }, [addToast]);

  useEffect(() => {
    const loadCreditDrivers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/driver-credits/drivers?limit=300', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.message || 'Failed to load driver credits');
        }
        setCreditDrivers(data.data || []);
      } catch (error: any) {
        addToast('error', error?.message || 'Failed to load driver credits');
      }
    };

    loadCreditDrivers();
  }, [addToast]);

  const purchaseCredits = async () => {
    if (!creditForm.driverId) {
      addToast('warning', 'Select a driver first');
      return;
    }

    if (!creditForm.credits || creditForm.credits <= 0) {
      addToast('warning', 'Credits must be greater than 0');
      return;
    }

    if (!creditForm.amountAfn || creditForm.amountAfn <= 0) {
      addToast('warning', 'Amount must be greater than 0');
      return;
    }

    setCreditSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/driver-credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverId: creditForm.driverId,
          packageName: creditForm.packageName,
          credits: creditForm.credits,
          amountAfn: creditForm.amountAfn,
          months: creditForm.months,
          paymentMethod: creditForm.paymentMethod,
          paymentReference: creditForm.paymentReference,
          notes: creditForm.notes,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.message || 'Credit purchase failed');
      }

      addToast('success', 'Driver credit purchase request created successfully');

      // Reset form
      setCreditForm({
        driverId: '',
        packageName: 'MONTHLY_STANDARD',
        credits: 120,
        months: 1,
        amountAfn: 3000,
        paymentMethod: 'CASH',
        paymentReference: '',
        notes: '',
      });

      // Refresh driver list
      const refresh = await fetch('/api/admin/driver-credits/drivers?limit=300', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshData = await refresh.json();
      if (refresh.ok && refreshData.success) {
        setCreditDrivers(refreshData.data || []);
      }

      // Refresh finance data
      const financeRefresh = await fetch('/api/admin/insights/finance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const financeData = await financeRefresh.json();
      if (financeRefresh.ok && financeData.success) {
        setPayload(financeData.data);
      }
    } catch (error: any) {
      addToast('error', error?.message || 'Credit purchase failed');
    } finally {
      setCreditSubmitting(false);
    }
  };

  const exportTransactionsCsv = () => {
    if (!payload) return;

    const headers = ['id', 'type', 'status', 'amount', 'description', 'userName', 'userRole', 'createdAt'];
    const rows = payload.recentTransactions.map((tx) => [
      tx.id,
      tx.type,
      tx.status,
      tx.amount,
      tx.description,
      tx.user?.name || '',
      tx.user?.role || '',
      tx.createdAt,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `${cell}`.replace(/,/g, ' ')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData = useMemo(
    () => (payload?.revenueTrend || []).map((item) => ({
      date: item.date,
      revenue: item.revenue,
      rides: item.rides,
    })),
    [payload]
  );

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 transition-colors duration-300 pb-24">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-white tracking-tight">Finance Overview</h1>
          <p className="text-dark-500 dark:text-dark-400">Live finance data from transactions and payouts.</p>
        </div>
        <Button variant="secondary" icon={<Download size={16} />} onClick={exportTransactionsCsv}>
          Download Transactions
        </Button>
      </header>

      {loading ? (
        <Card className="p-6 text-dark-500">Loading finance data...</Card>
      ) : !payload ? (
        <Card className="p-6 text-red-500">Finance data is unavailable.</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            <Card className="p-5">
              <div className="text-xs font-bold uppercase text-dark-500 mb-1">Total Credits</div>
              <div className="text-3xl font-black text-green-600">{payload.summary.totalCredits.toFixed(2)}</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-bold uppercase text-dark-500 mb-1">Total Debits</div>
              <div className="text-3xl font-black text-dark-900 dark:text-white">{payload.summary.totalDebits.toFixed(2)}</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-bold uppercase text-dark-500 mb-1">Net Cashflow</div>
              <div className={`text-3xl font-black ${payload.summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {payload.summary.netCashflow.toFixed(2)}
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-bold uppercase text-dark-500 mb-1">Pending Payouts</div>
              <div className="text-3xl font-black text-orange-500">{payload.summary.pendingPayouts}</div>
            </Card>
          </div>

          {/* Commission Revenue Card */}
          <Card className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-blue-200 dark:border-blue-800">
            <h3 className="font-bold text-xl mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <DollarSign size={24} className="text-blue-600" />
              Platform Commission Revenue (20% per trip)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mb-1">Total Fares</div>
                <div className="text-2xl font-black text-blue-900 dark:text-blue-100">
                  {payload.summary.totalCredits.toFixed(2)} AFN
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">From completed trips</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-green-600 dark:text-green-400 mb-1">Platform Commission (20%)</div>
                <div className="text-2xl font-black text-green-700 dark:text-green-400">
                  {(payload.summary.totalCredits * 0.20).toFixed(2)} AFN
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">iTaxi earnings</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-purple-600 dark:text-purple-400 mb-1">Driver Earnings (80%)</div>
                <div className="text-2xl font-black text-purple-700 dark:text-purple-400">
                  {(payload.summary.totalCredits * 0.80).toFixed(2)} AFN
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Paid to drivers</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 mb-1">Completed Trips</div>
                <div className="text-2xl font-black text-orange-700 dark:text-orange-400">
                  {payload.summary.transactionCount}
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">Total rides</div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Commission Model:</strong> Riders suggest their own fare. When driver accepts, 20% is deducted from driver's credit balance as platform commission. 
                Upon trip completion, driver receives 80% of the fare as earnings.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <Card className="lg:col-span-2">
              <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white">Completed Trips Revenue Trend (30d)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="financeRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#financeRev)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white">Payout Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-dark-500">Total Payouts</span><span className="font-bold">{payload.summary.totalPayouts.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-dark-500">Payout Count</span><span className="font-bold">{payload.summary.payoutCount}</span></div>
                <div className="flex justify-between"><span className="text-dark-500">Pending Payouts</span><span className="font-bold text-orange-500">{payload.summary.pendingPayouts}</span></div>
                <div className="flex justify-between"><span className="text-dark-500">Pending Transactions</span><span className="font-bold text-orange-500">{payload.summary.pendingTransactions}</span></div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="!p-0 overflow-hidden">
              <div className="p-4 border-b border-dark-100 dark:border-white/5">
                <h3 className="font-bold text-lg text-dark-900 dark:text-white">Recent Transactions</h3>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-dark-100 dark:divide-white/5">
                {payload.recentTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'CREDIT' ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
                        {tx.type === 'CREDIT' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-dark-900 dark:text-white">{tx.description}</div>
                        <div className="text-xs text-dark-500">{tx.user?.name || 'Unknown'} • {new Date(tx.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className={`font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-dark-900 dark:text-white'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden">
              <div className="p-4 border-b border-dark-100 dark:border-white/5">
                <h3 className="font-bold text-lg text-dark-900 dark:text-white flex items-center gap-2"><Clock size={18} /> Recent Payout Requests</h3>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-dark-100 dark:divide-white/5">
                {payload.recentPayouts.map((payout) => (
                  <div key={payout.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-dark-900 dark:text-white">{payout.driver.user.name}</div>
                      <div className="text-xs text-dark-500">{new Date(payout.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-dark-900 dark:text-white">{payout.amount.toFixed(2)}</div>
                      <div className={`text-xs font-bold ${payout.status === 'COMPLETED' ? 'text-green-600' : payout.status === 'FAILED' ? 'text-red-500' : 'text-orange-500'}`}>
                        {payout.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <Card>
              <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white">Driver Monthly Credit Sales (AFN Local)</h3>
              <div className="space-y-3">
                <select
                  value={creditForm.driverId}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, driverId: e.target.value }))}
                  className="w-full rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                >
                  <option value="">Select driver</option>
                  {creditDrivers.map((d) => (
                    <option key={d.driverId} value={d.driverId}>
                      {d.driverName} ({d.phone}) - credits: {d.creditBalance}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={creditForm.packageName}
                    onChange={(e) => setCreditForm((prev) => ({ ...prev, packageName: e.target.value }))}
                    className="rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                    placeholder="Package name"
                  />
                  <input
                    type="number"
                    min={1}
                    value={creditForm.credits}
                    onChange={(e) => setCreditForm((prev) => ({ ...prev, credits: Number(e.target.value) }))}
                    className="rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                    placeholder="Credits"
                  />
                  <input
                    type="number"
                    min={1}
                    value={creditForm.months}
                    onChange={(e) => setCreditForm((prev) => ({ ...prev, months: Number(e.target.value) }))}
                    className="rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                    placeholder="Months"
                  />
                  <input
                    type="number"
                    min={1}
                    value={creditForm.amountAfn}
                    onChange={(e) => setCreditForm((prev) => ({ ...prev, amountAfn: Number(e.target.value) }))}
                    className="rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                    placeholder="Amount AFN"
                  />
                </div>

                <select
                  value={creditForm.paymentMethod}
                  onChange={(e) =>
                    setCreditForm((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value as 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER',
                    }))
                  }
                  className="w-full rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                >
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>

                <input
                  type="text"
                  value={creditForm.paymentReference}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, paymentReference: e.target.value }))}
                  className="w-full rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                  placeholder="Payment reference / transaction ID"
                />
                <textarea
                  value={creditForm.notes}
                  onChange={(e) => setCreditForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3 py-2 text-sm"
                  placeholder="Notes"
                  rows={3}
                />

                <Button onClick={purchaseCredits} disabled={creditSubmitting}>
                  {creditSubmitting ? 'Processing...' : 'Apply Monthly Credit Purchase'}
                </Button>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden">
              <div className="p-4 border-b border-dark-100 dark:border-white/5">
                <h3 className="font-bold text-lg text-dark-900 dark:text-white">Driver Credit Status</h3>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-dark-100 dark:divide-white/5">
                {creditDrivers.map((driver) => (
                  <div key={driver.driverId} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-dark-900 dark:text-white">{driver.driverName}</div>
                      <div className="text-xs text-dark-500">{driver.phone}</div>
                      <div className="text-xs text-dark-500">
                        Expires: {driver.creditExpiresAt ? new Date(driver.creditExpiresAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-dark-900 dark:text-white">{driver.creditBalance} credits</div>
                      <div className={`text-xs font-bold ${driver.active ? 'text-green-600' : 'text-red-500'}`}>
                        {driver.active ? 'ACTIVE' : 'INACTIVE'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

