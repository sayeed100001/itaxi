
import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CreditCard, ArrowUpRight, ArrowDownLeft, Plus, History, Wallet, X } from 'lucide-react';
import { useAppStore } from '../../store';
import * as paymentService from '../../services/paymentService';

export const WalletPage: React.FC = () => {
    const { user, transactions, currentRole, addTransaction, addToast, updateUserProfile } = useAppStore();
    const isDriver = currentRole === 'DRIVER';
    const [showTopUp, setShowTopUp] = useState(false);
    const [showCreditRequest, setShowCreditRequest] = useState(false);
    const [amount, setAmount] = useState('');
    const [creditForm, setCreditForm] = useState({
        packageName: 'Bronze',
        credits: '30',
        amountAfn: '1500',
        paymentMethod: 'CASH' as 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER',
        paymentReference: '',
        notes: ''
    });
    const [driverCredit, setDriverCredit] = useState<{
        creditBalance: number;
        creditExpiresAt: string | null;
        monthlyPackage?: string | null;
        active: boolean;
    } | null>(null);
    
    // Fetch latest balance from backend
    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch('/api/payments/balance', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (typeof data.balance === 'number') {
                    updateUserProfile({ balance: data.balance });
                }
            } catch {
                // ignore, UI will fall back to last known balance
            }
        };
        fetchBalance();
    }, [updateUserProfile]);

    useEffect(() => {
        const fetchDriverCredit = async () => {
            if (!isDriver) return;
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const response = await fetch('/api/drivers/credit-status', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    setDriverCredit(data.data);
                }
            } catch {
                // ignore
            }
        };
        fetchDriverCredit();
    }, [isDriver]);

    // Sort transactions by date desc
    const sortedTx = [...transactions].sort((a, b) => b.date - a.date);

    const handleTopUp = async () => {
        if (!amount || isNaN(parseInt(amount))) return;
        
        try {
            await paymentService.redirectToCheckout(parseInt(amount));
        } catch (error: any) {
            addToast('error', error.message || 'Failed to initiate payment');
        }
    };

    const handleCreditRequest = async () => {
        if (!creditForm.packageName || !creditForm.credits || !creditForm.amountAfn) {
            addToast('error', 'Please fill all required fields');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/drivers/credit-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    packageName: creditForm.packageName,
                    credits: parseInt(creditForm.credits),
                    amountAfn: parseFloat(creditForm.amountAfn),
                    paymentMethod: creditForm.paymentMethod,
                    paymentReference: creditForm.paymentReference,
                    notes: creditForm.notes
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Failed to submit request');
            }

            addToast('success', 'Credit request submitted! Admin will review and approve.');
            setShowCreditRequest(false);
        } catch (error: any) {
            addToast('error', error?.message || 'Failed to submit request');
        }
    };

    const handlePayout = async () => {
        if (!amount || isNaN(parseInt(amount))) {
            addToast('warning', 'Please enter a valid amount');
            return;
        }
        
        const amountNum = parseInt(amount);
        if (amountNum <= 0) {
            addToast('warning', 'Amount must be greater than 0');
            return;
        }

        if (amountNum > (user?.balance || 0)) {
            addToast('error', 'Insufficient balance');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/payments/payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ amount: amountNum }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to request payout');
            }

            addToast('success', 'Payout request submitted successfully. Admin will review and process it.');
            setAmount('');
            setShowTopUp(false);
        } catch (error: any) {
            addToast('error', error?.message || 'Failed to request payout');
        }
    };

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 transition-colors duration-300 relative">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2 tracking-tight">{isDriver ? 'Earnings' : 'My Wallet'}</h1>
                <p className="text-dark-500 dark:text-dark-400">Manage your payments and transactions securely.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Premium Balance Card */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-indigo-700 dark:from-brand-700 dark:to-indigo-900 p-8 shadow-2xl shadow-brand-600/20 dark:shadow-brand-900/40 text-white">
                    {/* Mesh Gradient Effect */}
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10 mix-blend-overlay"></div>
                    <div className="absolute bottom-0 left-0 p-24 bg-brand-400/20 rounded-full blur-2xl transform -translate-x-10 translate-y-10"></div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-brand-100 text-sm font-semibold mb-1 opacity-80">Total Balance</div>
                                <div className="text-5xl font-black tracking-tight">؋{user?.balance?.toFixed(0) || '0'}</div>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
                                <Wallet className="text-white" size={24} />
                            </div>
                        </div>
                        
                        <div className="mt-8 flex gap-3">
                            <Button variant="glass" onClick={() => setShowTopUp(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/20 font-semibold backdrop-blur-md">
                                <Plus size={18} /> {isDriver ? 'Cash Out' : 'Top Up'}
                            </Button>
                            <Button variant="glass" className="bg-dark-900/20 hover:bg-dark-900/30 text-white border-white/10 font-semibold backdrop-blur-md">
                                <CreditCard size={18} /> Manage Cards
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats / Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="flex flex-col justify-center items-center p-6 hover:bg-white dark:hover:bg-white/5 transition-all cursor-pointer group shadow-sm hover:shadow-md border-transparent hover:border-dark-200 dark:hover:border-white/10">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 mb-4 group-hover:scale-110 transition-transform shadow-sm">
                            <ArrowDownLeft size={28} />
                        </div>
                        <div className="text-3xl font-bold text-dark-900 dark:text-white tracking-tight">
                            {sortedTx.filter(t => t.type === 'credit').length}
                        </div>
                        <div className="text-xs font-bold text-dark-400 uppercase tracking-wider mt-1">Credits</div>
                    </Card>
                    <Card className="flex flex-col justify-center items-center p-6 hover:bg-white dark:hover:bg-white/5 transition-all cursor-pointer group shadow-sm hover:shadow-md border-transparent hover:border-dark-200 dark:hover:border-white/10">
                        <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-4 group-hover:scale-110 transition-transform shadow-sm">
                            <History size={28} />
                        </div>
                        <div className="text-3xl font-bold text-dark-900 dark:text-white tracking-tight">{sortedTx.length}</div>
                        <div className="text-xs font-bold text-dark-400 uppercase tracking-wider mt-1">Transactions</div>
                    </Card>
                </div>
            </div>

            {isDriver && driverCredit && (
                <Card className="mb-8 p-5 border-dark-200 dark:border-white/10">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <div className="text-xs font-bold uppercase text-dark-500 mb-1">Monthly Driver Credits</div>
                            <div className="text-2xl font-black text-dark-900 dark:text-white">{driverCredit.creditBalance} credits</div>
                            <div className="text-xs text-dark-500 mt-1">
                                {driverCredit.creditExpiresAt
                                    ? `Valid until ${new Date(driverCredit.creditExpiresAt).toLocaleDateString()}`
                                    : 'No active package'}
                            </div>
                        </div>
                        <div className={`text-xs font-bold px-3 py-1 rounded-full ${driverCredit.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {driverCredit.active ? 'ACTIVE' : 'INACTIVE'}
                        </div>
                    </div>
                    <Button 
                        size="sm" 
                        className="w-full" 
                        onClick={() => setShowCreditRequest(true)}
                    >
                        Request Credit Package
                    </Button>
                    <div className="text-xs text-dark-500 mt-3">
                        1 credit = 1 AFN. Contact admin to purchase monthly credit packages (Cash, Mobile Money, or Bank Transfer).
                    </div>
                </Card>
            )}

            {/* Transactions List */}
            <Card className="!p-0 shadow-lg dark:shadow-none border-dark-100 dark:border-white/5">
                <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white">Recent Transactions</h3>
                    <button className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-500 uppercase tracking-wider">View All</button>
                </div>
                <div className="divide-y divide-dark-100 dark:divide-white/5">
                    {sortedTx.length === 0 ? (
                        <div className="p-8 text-center text-dark-500">No transactions yet.</div>
                    ) : sortedTx.map((tx) => (
                        <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${tx.type === 'debit' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                                    {tx.type === 'debit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                                </div>
                                <div>
                                    <div className="text-dark-900 dark:text-white font-bold text-base">{tx.description}</div>
                                    <div className="text-xs text-dark-500 font-medium mt-0.5">{new Date(tx.date).toLocaleString()}</div>
                                </div>
                            </div>
                            <div className={`text-lg font-black tracking-tight ${tx.type === 'debit' ? 'text-dark-900 dark:text-white' : 'text-green-600 dark:text-green-400'}`}>
                                {tx.type === 'debit' ? '-' : '+'}؋{tx.amount.toFixed(0)}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Top Up Modal Overlay */}
            {showTopUp && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-sm p-6 relative">
                        <button onClick={() => setShowTopUp(false)} className="absolute top-4 right-4 text-dark-400 hover:text-dark-900 dark:hover:text-white">
                            <X size={20}/>
                        </button>
                        <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Top Up Wallet</h3>
                        <p className="text-sm text-dark-500 mb-6">Enter amount to add to your balance.</p>
                        
                        <div className="flex gap-2 mb-4">
                            {[100, 500, 1000].map(val => (
                                <button 
                                    key={val}
                                    onClick={() => setAmount(val.toString())}
                                    className="flex-1 py-2 rounded-lg border border-dark-200 dark:border-white/10 hover:bg-dark-50 dark:hover:bg-white/5 text-sm font-bold"
                                >
                                    ؋{val}
                                </button>
                            ))}
                        </div>

                        <input 
                            type="number" 
                            className="w-full p-3 rounded-xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-xl font-bold mb-4 focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="Amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            autoFocus
                        />
                        
                        <Button size="lg" className="w-full" onClick={isDriver ? handlePayout : handleTopUp}>
                            {isDriver ? 'Request Payout' : 'Pay with Stripe'}
                        </Button>
                    </Card>
                </div>
            )}

            {/* Credit Request Modal */}
            {showCreditRequest && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setShowCreditRequest(false)} className="absolute top-4 right-4 text-dark-400 hover:text-dark-900 dark:hover:text-white">
                            <X size={20}/>
                        </button>
                        <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Request Credit Package</h3>
                        <p className="text-sm text-dark-500 mb-6">Submit a credit purchase request. Admin will review and approve.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase mb-2 block">Package Name</label>
                                <input 
                                    type="text" 
                                    value={creditForm.packageName}
                                    onChange={(e) => setCreditForm({...creditForm, packageName: e.target.value})}
                                    className="w-full p-3 rounded-xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-sm"
                                    placeholder="Bronze, Silver, Gold"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase mb-2 block">Credits (1 credit = 1 ride request)</label>
                                <input 
                                    type="number" 
                                    value={creditForm.credits}
                                    onChange={(e) => setCreditForm({...creditForm, credits: e.target.value})}
                                    className="w-full p-3 rounded-xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-sm"
                                    placeholder="30"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase mb-2 block">Amount (AFN)</label>
                                <input 
                                    type="number" 
                                    value={creditForm.amountAfn}
                                    onChange={(e) => setCreditForm({...creditForm, amountAfn: e.target.value})}
                                    className="w-full p-3 rounded-xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-sm"
                                    placeholder="1500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase mb-2 block">Payment Method</label>
                                <select 
                                    value={creditForm.paymentMethod}
                                    onChange={(e) => setCreditForm({...creditForm, paymentMethod: e.target.value as any})}
                                    className="w-full p-3 rounded-xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-sm"
                                >
                                    <option value="CASH">Cash</option>
                                    <option value="MOBILE_MONEY">Mobile Money</option>
                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase mb-2 block">Payment Reference (Optional)</label>
                                <input 
                                    type="text" 
                                    value={creditForm.paymentReference}
                                    onChange={(e) => setCreditForm({...creditForm, paymentReference: e.target.value})}
                                    className="w-full p-3 rounded-xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-sm"
                                    placeholder="Transaction ID"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase mb-2 block">Notes (Optional)</label>
                                <textarea 
                                    value={creditForm.notes}
                                    onChange={(e) => setCreditForm({...creditForm, notes: e.target.value})}
                                    className="w-full p-3 rounded-xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-sm"
                                    rows={3}
                                    placeholder="Additional information"
                                />
                            </div>
                        </div>
                        
                        <Button size="lg" className="w-full mt-6" onClick={handleCreditRequest}>
                            Submit Request
                        </Button>
                        <p className="text-xs text-dark-500 mt-3 text-center">
                            1 credit = 1 AFN. Valid for 30 days.
                        </p>
                    </Card>
                </div>
            )}
        </div>
    );
};
