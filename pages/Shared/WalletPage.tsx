
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CreditCard, ArrowUpRight, ArrowDownLeft, Plus, History, Wallet, X, Clock, Star } from 'lucide-react';
import { useAppStore } from '../../store';
import { useI18n } from '../../services/useI18n';

export const WalletPage: React.FC = () => {
    const user = useAppStore((state) => state.user);
    const transactions = useAppStore((state) => state.transactions);
    const creditRequests = useAppStore((state) => state.creditRequests);
    const currentRole = useAppStore((state) => state.currentRole);
    const requestCredit = useAppStore((state) => state.requestCredit);
    const addToast = useAppStore((state) => state.addToast);
    const { t, tx } = useI18n();
    const isDriver = currentRole === 'driver';
    const isRider = currentRole === 'rider';
    const [showTopUp, setShowTopUp] = useState(false);
    const [amount, setAmount] = useState('');

    // Sort transactions by date desc
    const sortedTx = [...transactions].sort((a, b) => b.date - a.date);
    const myCreditRequests = creditRequests.filter(cr => cr.driverId === user?.id).sort((a, b) => b.requestDate - a.requestDate);

    const handleTopUp = async () => {
        if (!amount || isNaN(parseInt(amount))) return;

        if (isDriver) {
            await requestCredit(parseInt(amount));
        }

        setAmount('');
        setShowTopUp(false);
    };

    // Calculate loyalty tier and apply discount automatically
    const loyaltyPoints = user?.loyaltyPoints || 0;
    const discountPercent = user?.discountPercent || 0;
    let loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
    let nextTierPoints = 10;
    let autoDiscount = 0;

    // Auto-calculate discount based on loyalty points
    if (loyaltyPoints >= 50) {
        loyaltyTier = 'platinum';
        nextTierPoints = 0;
        autoDiscount = 15;
    } else if (loyaltyPoints >= 30) {
        loyaltyTier = 'gold';
        nextTierPoints = 50 - loyaltyPoints;
        autoDiscount = 10;
    } else if (loyaltyPoints >= 10) {
        loyaltyTier = 'silver';
        nextTierPoints = 30 - loyaltyPoints;
        autoDiscount = 5;
    }

    return (
        <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-dark-50 dark:bg-dark-950 transition-colors duration-300 relative animate-fade-in">
            <header className="mb-5 md:mb-8">
                <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.875rem)' }} className="font-display font-bold text-dark-900 dark:text-white mb-1 tracking-tight">
                    {isDriver ? t.pages.wallet.title_driver : isRider ? t.pages.wallet.title_rider : t.pages.wallet.title_default}
                </h1>
                <p className="text-xs md:text-sm text-dark-500 dark:text-dark-400">
                    {isDriver ? t.pages.wallet.desc_driver : isRider ? t.pages.wallet.desc_rider : t.pages.wallet.desc_default}
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-5 md:mb-8">
                {/* Premium Balance/Loyalty Card */}
                <div className="relative overflow-hidden rounded-[24px] md:rounded-[32px] bg-dark-950 dark:bg-dark-900 p-5 md:p-8 shadow-fintech text-white animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    {/* Mesh Gradient Effect */}
                    <div className="absolute top-0 right-0 p-32 bg-brand-500/20 rounded-full blur-[80px] transform translate-x-10 -translate-y-10 mix-blend-screen"></div>
                    <div className="absolute bottom-0 left-0 p-24 bg-blue-500/20 rounded-full blur-[60px] transform -translate-x-10 translate-y-10 mix-blend-screen"></div>

                    <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px] md:min-h-[220px]">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-dark-300 text-sm font-medium mb-2 tracking-wide uppercase">
                                    {isRider ? t.pages.wallet.loyalty_points : t.pages.wallet.total_balance}
                                </div>
                                <div style={{ fontSize: 'clamp(1.75rem, 6vw, 3rem)' }} className="font-mono font-bold tracking-tighter">
                                    {isRider
                                        ? loyaltyPoints
                                        : (() => {
                                            const raw = (user as any)?.balance ?? 0;
                                            const bal = typeof raw === 'number' ? raw : Number.parseFloat(raw.toString()) || 0;
                                            return `؋${bal.toFixed(0)}`;
                                        })()
                                    }
                                </div>
                                {isRider && (
                                    <div className="mt-3 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/20">
                                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                        <span className="text-sm font-bold">
                                            {tx('pages.wallet.member_label', { tier: t.pages.wallet.tiers[loyaltyTier] })}
                                        </span>
                                        {autoDiscount > 0 && (
                                            <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full font-bold">
                                                {tx('pages.wallet.discount_badge', { percent: autoDiscount })}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-xl border border-white/10 shadow-glass">
                                {isRider ? <Star className="text-yellow-400" size={24} /> : <Wallet className="text-brand-400" size={24} />}
                            </div>
                        </div>

                        {isRider && nextTierPoints > 0 && (
                            <div className="mt-6">
                                <div className="text-xs text-dark-300 mb-2 font-medium">
                                    {tx('pages.wallet.more_rides_to_next', { count: nextTierPoints })}
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-brand-500 to-blue-500 rounded-full transition-all duration-500"
                                        style={{ width: `${(loyaltyPoints % (loyaltyTier === 'silver' ? 30 : 50)) / 20 * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {isDriver && (
                            <div className="mt-8 flex gap-3">
                                <Button variant="primary" onClick={() => setShowTopUp(true)} className="bg-brand-500 hover:bg-brand-600 text-white border-transparent font-semibold shadow-glow rounded-xl">
                                    <Plus size={18} /> {t.pages.wallet.request_credit}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats / Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="flex flex-col justify-center items-center p-4 md:p-6 hover:bg-white dark:hover:bg-dark-900 transition-all cursor-pointer group shadow-sm hover:shadow-fintech border-transparent hover:border-dark-200 dark:hover:border-white/10 rounded-[24px] animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-2 md:mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                            <ArrowDownLeft size={28} />
                        </div>
                        <div className="text-xl md:text-3xl font-mono font-bold text-dark-900 dark:text-white tracking-tight">
                            {sortedTx.filter(t => t.type === 'credit').length}
                        </div>
                        <div className="text-xs font-bold text-dark-400 uppercase tracking-wider mt-1">{t.pages.wallet.credits}</div>
                    </Card>
                    <Card className="flex flex-col justify-center items-center p-4 md:p-6 hover:bg-white dark:hover:bg-dark-900 transition-all cursor-pointer group shadow-sm hover:shadow-fintech border-transparent hover:border-dark-200 dark:hover:border-white/10 rounded-[24px] animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-dark-50 dark:bg-white/5 flex items-center justify-center text-dark-600 dark:text-dark-400 mb-2 md:mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                            <History size={28} />
                        </div>
                        <div className="text-xl md:text-3xl font-mono font-bold text-dark-900 dark:text-white tracking-tight">{sortedTx.length}</div>
                        <div className="text-xs font-bold text-dark-400 uppercase tracking-wider mt-1">{t.pages.wallet.transactions}</div>
                    </Card>
                </div>
            </div>

            {isDriver && myCreditRequests.length > 0 && (
                <Card className="!p-0 shadow-fintech dark:shadow-none border-dark-100 dark:border-white/5 mb-8 rounded-[24px] overflow-hidden animate-slide-up" style={{ animationDelay: '0.4s' }}>
                    <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-md">
                        <h3 className="text-lg font-display font-bold text-dark-900 dark:text-white">{t.pages.wallet.credit_requests}</h3>
                    </div>
                    <div className="divide-y divide-dark-100 dark:divide-white/5">
                        {myCreditRequests.map((req) => (
                            <div key={req.id} className="p-5 flex items-center justify-between hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm ${req.status === 'pending' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' : req.status === 'approved' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                                        {req.status === 'pending' ? <Clock size={20} /> : req.status === 'approved' ? <ArrowDownLeft size={20} /> : <X size={20} />}
                                    </div>
                                    <div>
                                        <div className="text-dark-900 dark:text-white font-bold text-base">{t.pages.wallet.credit_request}</div>
                                        <div className="text-xs text-dark-500 font-medium mt-0.5">{new Date(req.requestDate).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-mono font-bold tracking-tight text-dark-900 dark:text-white">
                                        ؋{req.amount.toFixed(0)}
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${req.status === 'pending' ? 'text-orange-500' : req.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
                                        {(() => {
                                            const st = String(req.status || '').toLowerCase();
                                            if (st === 'pending') return t.pages.wallet.status_pending;
                                            if (st === 'approved') return t.pages.wallet.status_approved;
                                            if (st === 'rejected') return t.pages.wallet.status_rejected;
                                            return String(req.status || '');
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card className="!p-0 shadow-fintech dark:shadow-none border-dark-100 dark:border-white/5 rounded-[24px] overflow-hidden animate-slide-up" style={{ animationDelay: '0.5s' }}>
                <div className="p-6 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-md">
                    <h3 className="text-lg font-display font-bold text-dark-900 dark:text-white">{t.pages.wallet.transaction_history}</h3>
                    <div className="flex items-center gap-2">
                        <select className="text-xs font-bold bg-dark-100 dark:bg-white/10 px-3 py-1.5 rounded-lg border-none outline-none">
                            <option>{t.pages.wallet.filter_all_time}</option>
                            <option>{t.pages.wallet.filter_this_month}</option>
                            <option>{t.pages.wallet.filter_last_month}</option>
                            <option>{t.pages.wallet.filter_last_3_months}</option>
                        </select>
                        <button className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-500 uppercase tracking-wider transition-colors px-3 py-1.5 bg-brand-50 dark:bg-brand-500/10 rounded-lg">{t.pages.wallet.export}</button>
                    </div>
                </div>
                <div className="divide-y divide-dark-100 dark:divide-white/5 max-h-[600px] overflow-y-auto">
                    {sortedTx.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-dark-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <History size={32} className="text-dark-400" />
                            </div>
                            <p className="text-dark-500 font-medium">{t.pages.wallet.no_transactions}</p>
                            <p className="text-xs text-dark-400 mt-1">{t.pages.wallet.no_transactions_desc}</p>
                        </div>
                    ) : sortedTx.map((tx) => {
                        const amount =
                            typeof tx.amount === 'number'
                                ? tx.amount
                                : Number.parseFloat((tx.amount as any) ?? '0') || 0;
                        return (
                            <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-dark-50 dark:hover:bg-white/5 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-sm ${tx.type === 'debit' ? 'bg-dark-100 dark:bg-white/10 text-dark-900 dark:text-white' : 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'}`}>
                                        {tx.type === 'debit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                                    </div>
                                    <div>
                                        <div className="text-dark-900 dark:text-white font-bold text-base">{tx.description}</div>
                                        <div className="text-xs text-dark-500 font-medium mt-0.5">{new Date(tx.date).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className={`text-lg font-mono font-bold tracking-tight ${tx.type === 'debit' ? 'text-dark-900 dark:text-white' : 'text-brand-600 dark:text-brand-400'}`}>
                                    {tx.type === 'debit' ? '-' : '+'}؋{amount.toFixed(0)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Card>

            {/* Top Up Modal Overlay */}
            {showTopUp && (
                <div className="absolute inset-0 z-50 bg-dark-950/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <Card className="w-full max-w-sm p-8 relative rounded-[32px] shadow-glass-dark border border-white/10 animate-slide-up">
                        <button onClick={() => setShowTopUp(false)} className="absolute top-6 right-6 text-dark-400 hover:text-dark-900 dark:hover:text-white transition-colors bg-dark-100 dark:bg-white/10 p-2 rounded-full">
                            <X size={16} />
                        </button>
                        <h3 className="text-2xl font-display font-bold text-dark-900 dark:text-white mb-2">{t.pages.wallet.modal_title_request_credit}</h3>
                        <p className="text-sm text-dark-500 mb-8">{t.pages.wallet.modal_desc_request_credit}</p>

                        <div className="flex gap-3 mb-6">
                            {[100, 500, 1000].map(val => (
                                <button
                                    key={val}
                                    onClick={() => setAmount(val.toString())}
                                    className="flex-1 py-3 rounded-xl border border-dark-200 dark:border-white/10 hover:bg-dark-50 dark:hover:bg-white/5 hover:border-brand-500 text-sm font-mono font-bold transition-all"
                                >
                                    ؋{val}
                                </button>
                            ))}
                        </div>

                        <div className="relative mb-8">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400 font-mono font-bold text-xl">؋</span>
                            <input
                                type="number"
                                className="w-full pl-10 pr-4 py-4 rounded-2xl bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 text-2xl font-mono font-bold focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                placeholder="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <Button
                            size="lg"
                            className="w-full rounded-xl py-4 text-base font-bold shadow-glow bg-brand-500 hover:bg-brand-600"
                            onClick={handleTopUp}
                        >
                            {isDriver ? t.pages.wallet.submit_request : t.pages.wallet.confirm_payment}
                        </Button>
                    </Card>
                </div>
            )}
        </div>
    );
};
