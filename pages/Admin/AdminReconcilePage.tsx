import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../store';

export function AdminReconcilePage() {
  const addToast = useAppStore((state) => state.addToast);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runReconciliation = async () => {
    if (!from || !to) {
      addToast('warning', 'Please select date range');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/payments/reconcile?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data?.error || 'Reconciliation failed');
      }

      setResult(data);
      addToast('success', 'Reconciliation completed successfully');
    } catch (error: any) {
      addToast('error', error?.message || 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <DollarSign className="w-8 h-8" />
        Payment Reconciliation
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Date</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <Button onClick={runReconciliation} disabled={loading} className="w-full">
            {loading ? 'Running...' : 'Run Reconciliation'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">Database Total</div>
                <div className="text-2xl font-bold">${result.dbTotal.toFixed(2)}</div>
                <div className="text-xs text-gray-400">{result.details.dbCount} transactions</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">Stripe Total</div>
                <div className="text-2xl font-bold">${result.stripeTotal.toFixed(2)}</div>
                <div className="text-xs text-gray-400">{result.details.stripeCount} payments</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">Mismatch</div>
                <div className={`text-2xl font-bold ${result.mismatch > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${result.mismatch.toFixed(2)}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {result.mismatch > 0 ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      <span className="text-red-600">Requires attention</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-green-600">Balanced</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transaction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-2">Database Transaction IDs</div>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                    {result.details.dbTransactionIds.map((id: string) => (
                      <div key={id}>{id}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-2">Stripe Payment IDs</div>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                    {result.details.stripePaymentIds.map((id: string) => (
                      <div key={id}>{id}</div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}