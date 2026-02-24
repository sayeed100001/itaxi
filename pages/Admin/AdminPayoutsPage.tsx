import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAppStore } from '../../store';

export function AdminPayoutsPage() {
  const addToast = useAppStore((state) => state.addToast);
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
  const [allPayouts, setAllPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    try {
      const token = localStorage.getItem('token');
      const [pending, all] = await Promise.all([
        fetch('/api/admin/payouts/pending', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/payouts/all', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const pendingData = await pending.json();
      const allData = await all.json();

      if (pendingData.success) setPendingPayouts(pendingData.data);
      if (allData.success) setAllPayouts(allData.data);
    } catch (error) {
      console.error('Failed to load payouts', error);
      addToast('error', 'Failed to load payouts');
    }
  };

  const processPayout = async (payoutId: string) => {
    setLoading(true);
    setProcessing(payoutId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/payouts/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payoutId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.message || 'Failed to process payout');
      }

      addToast('success', 'Payout processed successfully');
      loadPayouts();
    } catch (error: any) {
      addToast('error', error?.message || 'Failed to process payout');
    } finally {
      setLoading(false);
      setProcessing(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <DollarSign className="w-8 h-8" />
        Driver Payouts
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Pending Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPayouts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No pending payouts</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Driver</th>
                    <th className="text-left p-2">Amount</th>
                    <th className="text-left p-2">Requested</th>
                    <th className="text-left p-2">Stripe Account</th>
                    <th className="text-left p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayouts.map((payout) => (
                    <tr key={payout.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{payout.driver.user.name}</td>
                      <td className="p-2 font-bold">${payout.amount.toFixed(2)}</td>
                      <td className="p-2 text-xs">{new Date(payout.createdAt).toLocaleString()}</td>
                      <td className="p-2">
                        {payout.driver.stripeAccountId ? (
                          <span className="text-green-600 text-xs">✓ Connected</span>
                        ) : (
                          <span className="text-red-600 text-xs">✗ Not connected</span>
                        )}
                      </td>
                      <td className="p-2">
                      <Button
                        onClick={() => processPayout(payout.id)}
                        disabled={loading || !payout.driver.stripeAccountId || processing === payout.id}
                        size="sm"
                      >
                        {processing === payout.id ? 'Processing...' : 'Process'}
                      </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Driver</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Transfer ID</th>
                  <th className="text-left p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {allPayouts.map((payout) => (
                  <tr key={payout.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{payout.driver.user.name}</td>
                    <td className="p-2 font-bold">${payout.amount.toFixed(2)}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs flex items-center gap-1 w-fit ${
                          payout.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : payout.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : payout.status === 'PROCESSING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {payout.status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
                        {payout.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                        {payout.status === 'PROCESSING' && <Clock className="w-3 h-3" />}
                        {payout.status}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {payout.stripeTransferId ? payout.stripeTransferId.slice(0, 20) : '-'}
                    </td>
                    <td className="p-2 text-xs">{new Date(payout.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}