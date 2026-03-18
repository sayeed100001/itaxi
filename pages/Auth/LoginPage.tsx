
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAppStore } from '../../store';
import { ArrowRight, Smartphone, KeyRound, ArrowLeft, User, Car, Shield } from 'lucide-react';
import { translations } from '../../constants/translations';
import { API_BASE_URL } from '../../src/config/api';

export const LoginPage: React.FC = () => {
    const setUser = useAppStore((state) => state.setUser);
    const setAppMode = useAppStore((state) => state.setAppMode);
    const setRole = useAppStore((state) => state.setRole);
    const language = useAppStore((state) => state.language);
    const adminSettings = useAppStore((state) => state.adminSettings);
    const t = translations[language];
    const isRTL = language === 'fa';
    const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
    const BackIcon = isRTL ? ArrowRight : ArrowLeft;

    const addToast = useAppStore((state) => state.addToast);

    const recaptchaCfg = (adminSettings?.auth as any)?.recaptcha;
    const recaptchaEnabled = recaptchaCfg?.enabled === true;
    const recaptchaSiteKey = String(recaptchaCfg?.siteKey || '').trim();
    const recaptchaApplyTo: string[] = Array.isArray(recaptchaCfg?.applyTo) ? recaptchaCfg.applyTo : ['login', 'register'];

    const captchaContainerRef = useRef<HTMLDivElement>(null);
    const captchaWidgetIdRef = useRef<number | null>(null);
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    const [authType, setAuthType] = useState<'login' | 'signup'>('login');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState<'rider' | 'driver'>('rider');

    const [step, setStep] = useState<'credentials' | 'otp' | '2fa'>('credentials');
    const [otpCode, setOtpCode] = useState('');
    const [otpToken, setOtpToken] = useState('');
    const [otpDelivery, setOtpDelivery] = useState<{ channel?: string; to?: string; expiresAt?: string } | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [twoFactorTempToken, setTwoFactorTempToken] = useState('');

    const needsCaptcha = recaptchaEnabled && recaptchaSiteKey && recaptchaApplyTo.includes(authType === 'login' ? 'login' : 'register');

    // Load reCAPTCHA script and render widget
    useEffect(() => {
        if (!needsCaptcha || step !== 'credentials') return;

        const scriptId = 'recaptcha-script';
        const renderWidget = () => {
            if (!captchaContainerRef.current || !(window as any).grecaptcha) return;
            if (captchaWidgetIdRef.current !== null) return;
            try {
                captchaWidgetIdRef.current = (window as any).grecaptcha.render(captchaContainerRef.current, {
                    sitekey: recaptchaSiteKey,
                    callback: (token: string) => setCaptchaToken(token),
                    'expired-callback': () => setCaptchaToken(null)
                });
            } catch {}
        };

        if (!(window as any).grecaptcha) {
            if (!document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
                script.async = true;
                script.defer = true;
                (window as any).onRecaptchaLoad = renderWidget;
                document.head.appendChild(script);
            } else {
                (window as any).onRecaptchaLoad = renderWidget;
            }
        } else {
            setTimeout(renderWidget, 100);
        }

        return () => {
            captchaWidgetIdRef.current = null;
            setCaptchaToken(null);
        };
    }, [needsCaptcha, authType, step, recaptchaSiteKey]);

    const resetCaptcha = () => {
        setCaptchaToken(null);
        if (captchaWidgetIdRef.current !== null && (window as any).grecaptcha) {
            try { (window as any).grecaptcha.reset(captchaWidgetIdRef.current); } catch {}
        }
        captchaWidgetIdRef.current = null;
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (needsCaptcha && !captchaToken) {
            addToast('error', 'Please complete the CAPTCHA.');
            return;
        }
        setLoading(true);

        const endpoint = authType === 'login' ? '/auth/login' : '/auth/register';
        const payload = authType === 'login'
            ? { phone, password, captchaToken: captchaToken || undefined }
            : { phone, password, name, role: selectedRole, captchaToken: captchaToken || undefined };

        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                if (data.requires2FA && data.tempToken) {
                    setTwoFactorTempToken(String(data.tempToken));
                    setTwoFactorCode('');
                    setStep('2fa');
                    addToast('info', 'Enter your 2FA code to continue.');
                    resetCaptcha();
                    return;
                }

                if (data.requiresOTP && data.otpToken) {
                    setOtpToken(String(data.otpToken));
                    setOtpCode('');
                    setOtpDelivery(data.delivery || null);
                    setStep('otp');
                    addToast('info', `OTP sent via ${String(data?.delivery?.channel || 'secure channel')}.`);
                    resetCaptcha();
                    return;
                }

                if (data.token) localStorage.setItem('token', data.token);
                setUser(data.user);
                setRole(data.user.role);
                setAppMode('app');
                addToast('success', authType === 'login' ? 'Welcome back!' : 'Account created successfully!');
            } else {
                addToast('error', data.error || 'Authentication failed');
                resetCaptcha();
            }
        } catch (err) {
            console.error(err);
            addToast('error', 'Network error. Please try again.');
            resetCaptcha();
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otpToken, code: otpCode })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                addToast('error', data?.error || `OTP failed (HTTP ${res.status})`);
                return;
            }
            if (data.token) localStorage.setItem('token', data.token);
            setUser(data.user);
            setRole(data.user.role);
            setAppMode('app');
            addToast('success', 'Verified successfully.');
        } catch (err) {
            console.error(err);
            addToast('error', 'Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/auth/verify-2fa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken: twoFactorTempToken, code: twoFactorCode })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                addToast('error', data?.error || `2FA failed (HTTP ${res.status})`);
                return;
            }
            if (data.token) localStorage.setItem('token', data.token);
            setUser(data.user);
            setRole(data.user.role);
            setAppMode('app');
            addToast('success', 'Welcome back!');
        } catch (err) {
            console.error(err);
            addToast('error', 'Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            <button
                onClick={() => setAppMode('landing')}
                className="absolute top-4 start-4 sm:top-6 sm:start-6 flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors z-20 text-sm"
            >
                <BackIcon size={18} /> {t.common.back}
            </button>

            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-400/20 dark:bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

            <Card className="w-full max-w-md mx-4 border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 p-6 sm:p-8">
                <div className="text-center mb-6">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-brand-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-brand-500/20">
                        <span className="text-2xl sm:text-3xl font-bold text-white">{language === 'fa' ? 'آ' : 'iT'}</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(1.25rem, 5vw, 1.5rem)' }} className="font-bold text-slate-900 dark:text-white mb-2">
                        {authType === 'login' ? t.auth.welcome_back : 'Create Account'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                        {authType === 'login' ? t.auth.sign_in_text : 'Join iTaxi today and start moving.'}
                    </p>
                </div>

                {/* Auth Type Toggles */}
                <div className="flex bg-slate-100 dark:bg-dark-950/50 p-1 rounded-xl mb-6 border border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => { setAuthType('login'); setStep('credentials'); resetCaptcha(); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authType === 'login' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-sm' : 'text-slate-500'}`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => { setAuthType('signup'); setStep('credentials'); resetCaptcha(); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authType === 'signup' ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white shadow-sm' : 'text-slate-500'}`}
                    >
                        Sign Up
                    </button>
                </div>

                {/* Role Selector (Only for Signup) */}
                {authType === 'signup' && step === 'credentials' && (
                    <div className="mb-6">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1 mb-2 block">Select Portal</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'rider', icon: User, label: t.roles.rider },
                                { id: 'driver', icon: Car, label: t.roles.driver }
                            ].map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedRole(r.id as any)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${selectedRole === r.id
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

                {step === 'credentials' ? (
                    <form onSubmit={handleAuth} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
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
                                    required
                                />
                            </div>
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">Phone Number</label>
                        <div className="relative">
                            <Smartphone className="absolute start-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                            <input
                                type="tel"
                                placeholder="+1 234 567 8900"
                                className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 ps-11 pe-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-start"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">Password</label>
                        <div className="relative">
                            <KeyRound className="absolute start-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 ps-11 pe-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-start"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    {needsCaptcha && (
                        <div className="flex justify-center">
                            <div ref={captchaContainerRef} />
                        </div>
                    )}
                    <Button type="submit" size="lg" isLoading={loading} disabled={needsCaptcha && !captchaToken} className="w-full mt-4">
                        {authType === 'login' ? 'Login' : 'Create Account'} <ArrowIcon size={18} className="rtl:rotate-180" />
                    </Button>

                    {authType === 'login' && (
                        <div className="mt-6 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-500/20 text-center">
                            <p className="text-xs font-bold text-brand-600 dark:text-brand-400 mb-1">Admin Demo Credentials</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 font-mono">
                                Phone: +10000000000<br />
                                Pass: admin123
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setPhone('+10000000000');
                                    setPassword('admin123');
                                }}
                                className="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                            >
                                Fill Admin Credentials
                            </button>
                        </div>
                    )}
                </form>
                ) : step === 'otp' ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-900/10">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                                    <Shield size={18} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white">OTP Verification</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                        {otpDelivery?.channel ? `Channel: ${otpDelivery.channel}` : 'Channel: secure'}
                                        {otpDelivery?.to ? ` • To: ${otpDelivery.to}` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">Code</label>
                            <div className="relative">
                                <KeyRound className="absolute start-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder="123456"
                                    className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 ps-11 pe-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-start tracking-[0.3em] font-mono"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                                    required
                                />
                            </div>
                        </div>

                        <Button type="submit" size="lg" isLoading={loading} className="w-full mt-2">
                            Verify <ArrowIcon size={18} className="rtl:rotate-180" />
                        </Button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep('credentials');
                                setOtpToken('');
                                setOtpCode('');
                                setOtpDelivery(null);
                            }}
                            className="w-full text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Back to login
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify2FA} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-900/10">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                    <Shield size={18} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white">2FA Verification</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Enter the code from your authenticator app.</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ms-1">Code</label>
                            <div className="relative">
                                <KeyRound className="absolute start-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder="123456"
                                    className="w-full bg-slate-50 dark:bg-dark-950/50 border border-slate-200 dark:border-white/10 rounded-xl py-3 ps-11 pe-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-start tracking-[0.3em] font-mono"
                                    value={twoFactorCode}
                                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                                    required
                                />
                            </div>
                        </div>

                        <Button type="submit" size="lg" isLoading={loading} className="w-full mt-2">
                            Verify <ArrowIcon size={18} className="rtl:rotate-180" />
                        </Button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep('credentials');
                                setTwoFactorCode('');
                                setTwoFactorTempToken('');
                            }}
                            className="w-full text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Back to login
                        </button>
                    </form>
                )}
            </Card>
        </div>
    );
};
