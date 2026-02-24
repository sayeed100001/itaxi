import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAppStore } from '../../store';
import { ArrowRight, Smartphone, KeyRound, ArrowLeft, User, Car, Shield } from 'lucide-react';
import { translations } from '../../constants/translations';
import { authService } from '../../services/enterprise-api';

export const EnterpriseLoginPage: React.FC = () => {
    const { setUser, setAppMode, setRole, language, addToast } = useAppStore();
    const t = translations[language];
    const isRTL = language === 'fa';
    const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
    const BackIcon = isRTL ? ArrowRight : ArrowLeft;

    const [authType, setAuthType] = useState<'login' | 'signup'>('login');
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState<'RIDER' | 'DRIVER' | 'ADMIN'>('RIDER');

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const response = await authService.sendOTP({
                phone,
                name: authType === 'signup' ? name : undefined,
                role: selectedRole
            });
            
            if (response.data.success) {
                addToast('success', 'OTP sent to your phone');
                if (response.data.data?.otp) {
                    addToast('info', `Dev OTP: ${response.data.data.otp}`);
                }
                setStep('otp');
            } else {
                addToast('error', response.data.message || 'Failed to send OTP');
            }
        } catch (error: any) {
            console.error('OTP send error:', error);
            addToast('error', error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const otpCode = otp.join('');
            const response = await authService.verifyOTP({
                phone,
                code: otpCode,
                name: authType === 'signup' ? name : undefined,
                role: selectedRole
            });
            
            if (response.data.success) {
                const { token, user, refreshToken } = response.data.data;
                
                // Store tokens
                localStorage.setItem('token', token);
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                } else {
                    localStorage.removeItem('refreshToken');
                }
                localStorage.setItem('user', JSON.stringify(user));
                
                // Update store
                setRole(user.role as any);
                setUser({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role as any,
                    rating: user.rating || 4.85,
                    balance: user.balance || 0,
                    totalTrips: user.totalTrips || 0
                });
                
                addToast('success', 'Login successful');
                addToast('info', `Welcome back, ${user.name}!`);
            } else {
                addToast('error', response.data.message || 'Invalid OTP');
            }
        } catch (error: any) {
            console.error('OTP verification error:', error);
            addToast('error', error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            <button 
                onClick={() => setAppMode('landing')}
                className="absolute top-6 start-6 flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors z-20"
            >
                <BackIcon size={20} /> {t.common.back}
            </button>

            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-400/20 dark:bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

            <Card className="w-full max-w-md mx-4 border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 p-8">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-tr from-brand-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-brand-500/20">
                        <span className="text-3xl font-bold text-white">{language === 'fa' ? 'آ' : 'iT'}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {authType === 'login' ? t.auth.welcome_back : 'Create Account'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {authType === 'login' ? t.auth.sign_in_text : 'Join iTaxi today and start moving.'}
                    </p>
                </div>

                {/* Auth Type Toggles */}
                {step === 'phone' && (
                    <div className="flex bg-slate-100 dark:bg-dark-950/50 p-1 rounded-xl mb-6 border border-slate-200 dark:border-white/10">
                        <button 
                            onClick={() => setAuthType('login')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authType === 'login' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-sm' : 'text-slate-500'}`}
                        >
                            Login
                        </button>
                        <button 
                            onClick={() => setAuthType('signup')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authType === 'signup' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-sm' : 'text-slate-500'}`}
                        >
                            Sign Up
                        </button>
                    </div>
                )}

                {/* Role Selector */}
                {step === 'phone' && (
                    <div className="mb-6">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1 mb-2 block">Select Portal</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'RIDER', icon: User, label: t.roles.rider },
                                { id: 'DRIVER', icon: Car, label: t.roles.driver },
                                { id: 'ADMIN', icon: Shield, label: 'Admin' }
                            ].map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedRole(r.id as 'RIDER' | 'DRIVER' | 'ADMIN')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                                        selectedRole === r.id 
                                        ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 text-brand-600 dark:text-brand-400' 
                                        : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 dark:hover:border-white/20'
                                    }`}
                                >
                                    <r.icon size={20} className="mb-1" />
                                    <span className="text-[10px] font-bold uppercase">{r.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'phone' ? (
                    <form onSubmit={handleSendOtp} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        {authType === 'signup' && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute start-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                                    <input 
                                        type="text"
                                        placeholder="John Doe"
                                        className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 ps-11 pe-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required={authType === 'signup'}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">{t.auth.mobile_label}</label>
                            <div className="relative">
                                <Smartphone className="absolute start-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                                <input 
                                    type="tel"
                                    dir="ltr"
                                    placeholder="079 000 0000"
                                    className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 ps-11 pe-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-start"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" size="lg" isLoading={loading} className="w-full mt-4">
                            {t.auth.continue} <ArrowIcon size={18} className="rtl:rotate-180" />
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                         <div className="text-center">
                            <div className="text-sm text-slate-500 dark:text-slate-300 mb-6">
                                {t.auth.enter_code} <br/><span className="text-brand-600 dark:text-brand-400 font-medium" dir="ltr">{phone}</span>
                            </div>
                            <div className="flex justify-center gap-3 mb-6" dir="ltr">
                                {otp.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        id={`otp-${idx}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        className="w-14 h-16 bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl text-center text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                                    />
                                ))}
                            </div>
                         </div>
                        <Button type="submit" size="lg" isLoading={loading} className="w-full">
                            {t.auth.verify_login} <KeyRound size={18} />
                        </Button>
                        <button 
                            type="button" 
                            onClick={() => setStep('phone')}
                            className="w-full text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            {t.auth.change_phone}
                        </button>
                    </form>
                )}
            </Card>
        </div>
    );
};
