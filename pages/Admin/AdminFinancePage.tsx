
import React, { useEffect } from 'react';
import { useAppStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Check, X, Clock, ArrowDownLeft, ArrowUpRight, DollarSign } from 'lucide-react';

export const AdminFinancePage: React.FC = () => {
    const fetchFinancials = useAppStore((state) => state.fetchFinancials);
    const processRequest = useAppStore((state) => state.processRequest);
    const withdrawalRequests = useAppStore((state) => state.withdrawalRequests);
    const creditRequests = useAppStore((state) => state.creditRequests);

    useEffect(() => {
        fetchFinancials();
    }, []);

    const pendingWithdrawals = withdrawalRequests.filter(w => w.status === 'pending');
    const pendingCredits = creditRequests.filter(c => c.status === 'pending');

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-dark-50 dark:bg-dark-950">
            <header className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-dark-900 dark:text-white mb-2">Financial Operations</h1>
                <p className="text-dark-500 dark:text-dark-400">Manage driver withdrawals and credit requests.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Withdrawals Section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
                        <ArrowUpRight className="text-red-500" /> Pending Withdrawals
                    </h2>
                    
                    {pendingWithdrawals.length === 0 ? (
                        <Card className="p-8 text-center text-dark-500">No pending withdrawals.</Card>
                    ) : (
                        pendingWithdrawals.map(req => (
                            <Card key={req.id} className="border-l-4 border-l-red-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="font-bold text-lg text-dark-900 dark:text-white">{req.driverName}</div>
                                        <div className="text-sm text-dark-500">{req.method} • {new Date(req.requestDate).toLocaleDateString()}</div>
                                        {req.accountDetails && <div className="text-xs font-mono bg-dark-100 dark:bg-white/10 p-1 rounded mt-1">{req.accountDetails}</div>}
                                    </div>
                                    <div className="text-2xl font-mono font-bold text-dark-900 dark:text-white">
                                        ؋{req.amount}
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => processRequest(req.id, 'withdrawal', 'rejected')}
                                    >
                                        <X size={16} className="mr-1" /> Reject
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => processRequest(req.id, 'withdrawal', 'approved')}
                                    >
                                        <Check size={16} className="mr-1" /> Approve
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Credit Requests Section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
                        <ArrowDownLeft className="text-green-500" /> Credit Requests
                    </h2>

                    {pendingCredits.length === 0 ? (
                        <Card className="p-8 text-center text-dark-500">No pending credit requests.</Card>
                    ) : (
                        pendingCredits.map(req => (
                            <Card key={req.id} className="border-l-4 border-l-green-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="font-bold text-lg text-dark-900 dark:text-white">{req.driverName}</div>
                                        <div className="text-sm text-dark-500">{new Date(req.requestDate).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-2xl font-mono font-bold text-dark-900 dark:text-white">
                                        ؋{req.amount}
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => processRequest(req.id, 'credit', 'rejected')}
                                    >
                                        <X size={16} className="mr-1" /> Reject
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => processRequest(req.id, 'credit', 'approved')}
                                    >
                                        <Check size={16} className="mr-1" /> Approve
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
