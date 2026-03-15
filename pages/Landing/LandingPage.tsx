import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store';
import { Button } from '../../components/ui/Button';
import {
    ArrowRight, ArrowLeft, Menu, X, Moon, Sun,
    MapPin, ShieldCheck, MessageCircle, Wallet, Users, BarChart3, Globe, Zap, Phone, Mail
} from 'lucide-react';
import { translations } from '../../constants/translations';

type NavLink = { href: string; label: string };

export const LandingPage: React.FC = () => {
    const setAppMode = useAppStore((state) => state.setAppMode);
    const isDarkMode = useAppStore((state) => state.isDarkMode);
    const toggleDarkMode = useAppStore((state) => state.toggleDarkMode);
    const language = useAppStore((state) => state.language);
    const setLanguage = useAppStore((state) => state.setLanguage);
    const adminSettings = useAppStore((state) => state.adminSettings);

    const t = translations[language];
    const isRTL = language === 'fa';
    const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
    const year = new Date().getFullYear();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Maintenance mode: block unauthenticated users too
    const maintenanceMode = (adminSettings as any)?.portals?.maintenanceMode === true;
    if (maintenanceMode) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-8 text-center">
                <div className="text-6xl mb-6">🔧</div>
                <h1 className="text-3xl font-bold mb-3">سیستم در حال نگهداری است</h1>
                <p className="text-zinc-400 text-lg mb-2">لطفاً بعداً دوباره تلاش کنید.</p>
                <p className="text-zinc-600 text-sm">System is under maintenance. Please try again later.</p>
            </div>
        );
    }

    const navLinks: NavLink[] = useMemo(() => ([
        { href: '#ride', label: t.landing.nav_ride },
        { href: '#drive', label: t.landing.nav_drive },
        { href: '#business', label: t.landing.nav_business },
        { href: '#safety', label: t.landing.nav_safety },
        { href: '#about', label: t.landing.nav_about },
        { href: '#contact', label: t.landing.nav_contact },
    ]), [t]);

    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <div className="relative min-h-dvh overflow-x-hidden bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white transition-colors duration-500">
            {/* Background atmosphere */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[820px] md:w-[1100px] h-[420px] md:h-[620px] bg-brand-500/15 dark:bg-brand-600/20 rounded-[999px] blur-[110px] pointer-events-none" />
            <div className="absolute -bottom-28 right-[-120px] w-[540px] md:w-[780px] h-[520px] md:h-[700px] bg-emerald-400/10 dark:bg-emerald-500/10 rounded-[999px] blur-[120px] pointer-events-none" />

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-950/80 pt-safe">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-3">
                    {/* Brand */}
                    <a href="#top" onClick={closeMobileMenu} className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-500 to-blue-600 flex items-center justify-center text-white font-extrabold text-[12px] shadow-lg shadow-brand-500/25">
                            {language === 'fa' ? 'آ' : 'iT'}
                        </div>
                        <span className={`text-base md:text-lg font-bold tracking-tight ${language === 'en' ? 'font-display' : ''}`}>
                            {t.brand}
                        </span>
                    </a>

                    {/* Desktop nav */}
                    <div className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {navLinks.map((l) => (
                            <a
                                key={l.href}
                                href={l.href}
                                className="hover:text-brand-700 dark:hover:text-white transition-colors"
                            >
                                {l.label}
                            </a>
                        ))}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
                            className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                            {language === 'en' ? 'FA' : 'EN'}
                        </button>
                        <button
                            onClick={toggleDarkMode}
                            className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                            aria-label="Toggle theme"
                        >
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                        </button>

                        <button
                            onClick={() => setAppMode('auth')}
                            className="hidden sm:block text-sm font-semibold text-slate-700 dark:text-white hover:text-brand-700 dark:hover:text-white transition-colors px-2"
                        >
                            {t.landing.login}
                        </button>

                        <div className="hidden sm:block">
                            <Button
                                onClick={() => setAppMode('auth')}
                                size="sm"
                                variant="gradient"
                                className="text-xs rounded-xl shadow-blue-500/25"
                            >
                                {t.landing.get_ride}
                            </Button>
                        </div>

                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMobileMenuOpen((v) => !v)}
                            className="lg:hidden w-9 h-9 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                            aria-label="Open menu"
                            aria-expanded={mobileMenuOpen}
                            aria-controls="landing-mobile-menu"
                        >
                            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div id="landing-mobile-menu" className="lg:hidden border-t border-slate-200/60 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-1">
                            {navLinks.map((l) => (
                                <a
                                    key={l.href}
                                    href={l.href}
                                    onClick={closeMobileMenu}
                                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    {l.label}
                                </a>
                            ))}

                            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Button onClick={() => setAppMode('auth')} size="md" className="w-full" icon={<ArrowIcon size={16} />}>
                                    {t.landing.get_ride}
                                </Button>
                                <Button onClick={() => setAppMode('auth')} variant="glass" size="md" className="w-full">
                                    {t.landing.become_driver}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Hero */}
            <main id="top" className="pt-24 md:pt-28">
                <section className="relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-16">
                        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-center">
                            {/* Copy */}
                            <div className="md:col-span-6 space-y-5">
                                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/85 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold">
                                    <Zap size={14} className="text-brand-600" />
                                    <span>{t.slogan}</span>
                                </div>

                                <h1
                                    style={{ fontSize: 'clamp(1.9rem, 5.3vw, 3.75rem)', lineHeight: 1.06 }}
                                    className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${language === 'en' ? 'font-display' : ''}`}
                                >
                                    {t.landing.tagline_prefix}{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500">
                                        {t.landing.tagline_highlight}
                                    </span>
                                </h1>

                                <p className="text-sm md:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                                    {t.landing.hero_desc}
                                </p>

                                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                                    <Button onClick={() => setAppMode('auth')} size="lg" className="w-full sm:w-auto" icon={<ArrowIcon size={18} />}>
                                        {t.landing.get_ride}
                                    </Button>
                                    <Button onClick={() => setAppMode('auth')} variant="glass" size="lg" className="w-full sm:w-auto">
                                        {t.landing.become_driver}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                                    <div className="flex items-center gap-2 bg-white/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 rounded-2xl px-3 py-2">
                                        <ShieldCheck size={16} className="text-emerald-500" />
                                        <span className="font-semibold">{t.landing.trust_kyc}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 rounded-2xl px-3 py-2">
                                        <MessageCircle size={16} className="text-brand-600" />
                                        <span className="font-semibold">{t.landing.trust_whatsapp}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 rounded-2xl px-3 py-2">
                                        <MapPin size={16} className="text-orange-500" />
                                        <span className="font-semibold">{t.landing.trust_admin}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Visual mock */}
                            <div className="md:col-span-6">
                                <div className="relative mx-auto max-w-xl">
                                    <div className="relative rounded-[28px] border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-fintech overflow-hidden">
                                        <div className="p-4 sm:p-5">
                                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                                                <span className="font-semibold">iTaxi</span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-3 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                    <span className="w-3 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                    <span className="w-4 h-1 rounded-full bg-emerald-400" />
                                                </span>
                                            </div>

                                            <div className="relative h-64 sm:h-80 rounded-3xl overflow-hidden bg-gradient-to-br from-slate-100 to-white dark:from-slate-900 dark:to-slate-950">
                                                <div className="absolute inset-0 opacity-60">
                                                    <svg width="100%" height="100%">
                                                        <defs>
                                                            <pattern id="grid-md" width="28" height="28" patternUnits="userSpaceOnUse">
                                                                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#64748b" strokeWidth="0.6" />
                                                            </pattern>
                                                        </defs>
                                                        <rect width="100%" height="100%" fill="url(#grid-md)" />
                                                    </svg>
                                                </div>

                                                {/* Route line */}
                                                <div className="absolute inset-0">
                                                    <svg viewBox="0 0 400 240" className="w-full h-full">
                                                        <path
                                                            d="M70,180 C110,140 130,160 170,128 C205,100 240,112 270,88 C300,64 330,70 350,52"
                                                            fill="none"
                                                            stroke="rgba(37, 99, 235, 0.85)"
                                                            strokeWidth="3.5"
                                                            strokeLinecap="round"
                                                        />
                                                        <circle cx="70" cy="180" r="6" fill="rgba(16, 185, 129, 0.95)" />
                                                        <circle cx="350" cy="52" r="6" fill="rgba(249, 115, 22, 0.95)" />
                                                    </svg>
                                                </div>

                                                {/* Cards */}
                                                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                                                    <div className="bg-white/85 dark:bg-white/10 backdrop-blur-md border border-white/25 dark:border-white/10 rounded-2xl px-3 py-2 text-[11px] font-bold text-slate-800 dark:text-white flex items-center gap-2 shadow-lg">
                                                        <ShieldCheck size={14} className="text-emerald-500" />
                                                        {t.landing.safety_title}
                                                    </div>
                                                    <div className="bg-white/85 dark:bg-white/10 backdrop-blur-md border border-white/25 dark:border-white/10 rounded-2xl px-3 py-2 text-[11px] font-bold text-slate-800 dark:text-white flex items-center gap-2 shadow-lg">
                                                        <Wallet size={14} className="text-brand-600" />
                                                        {t.landing.driver_title}
                                                    </div>
                                                </div>

                                                <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-3xl p-3 shadow-lg">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-9 h-9 rounded-2xl bg-brand-600/15 dark:bg-brand-500/15 flex items-center justify-center">
                                                                <MapPin size={16} className="text-brand-700 dark:text-brand-400" />
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-extrabold text-slate-900 dark:text-white">{t.landing.how_step1_title}</div>
                                                                <div className="text-[11px] text-slate-500 dark:text-slate-300">{t.landing.how_step3_title}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                                                            <Users size={15} className="text-slate-500 dark:text-slate-300" />
                                                            iTaxi
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-brand-500/25 rounded-full blur-2xl pointer-events-none" />
                                    <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section id="ride" className="py-12 md:py-20 scroll-mt-24">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="max-w-2xl">
                            <h2 className={`heading-xl ${language === 'en' ? 'font-display' : ''}`}>{t.landing.how_title}</h2>
                            <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">{t.landing.how_desc}</p>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                            {[
                                { icon: <MapPin size={18} className="text-brand-600" />, title: t.landing.how_step1_title, desc: t.landing.how_step1_desc },
                                { icon: <Zap size={18} className="text-orange-500" />, title: t.landing.how_step2_title, desc: t.landing.how_step2_desc },
                                { icon: <MessageCircle size={18} className="text-emerald-500" />, title: t.landing.how_step3_title, desc: t.landing.how_step3_desc },
                            ].map((s, idx) => (
                                <div key={idx} className="bg-white/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-sm">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center">
                                        {s.icon}
                                    </div>
                                    <h3 className="mt-3 text-sm md:text-base font-extrabold text-slate-900 dark:text-white">{s.title}</h3>
                                    <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Drive / Business / Safety */}
                <section className="py-12 md:py-20 bg-white dark:bg-slate-900/50 border-y border-slate-200/60 dark:border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="max-w-2xl">
                            <h2 className={`heading-xl ${language === 'en' ? 'font-display' : ''}`}>{t.landing.why_choose}</h2>
                            <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300">{t.landing.why_desc}</p>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                            <div id="drive" className="scroll-mt-24 bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-3xl p-5 md:p-6">
                                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center">
                                    <Wallet size={18} className="text-brand-600" />
                                </div>
                                <h3 className="mt-3 text-sm md:text-base font-extrabold">{t.landing.driver_title}</h3>
                                <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.landing.driver_desc}</p>
                            </div>

                            <div id="business" className="scroll-mt-24 bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-3xl p-5 md:p-6">
                                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center">
                                    <BarChart3 size={18} className="text-orange-500" />
                                </div>
                                <h3 className="mt-3 text-sm md:text-base font-extrabold">{t.landing.admin_title}</h3>
                                <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.landing.admin_desc}</p>
                            </div>

                            <div id="safety" className="scroll-mt-24 bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-3xl p-5 md:p-6">
                                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center">
                                    <ShieldCheck size={18} className="text-emerald-500" />
                                </div>
                                <h3 className="mt-3 text-sm md:text-base font-extrabold">{t.landing.safety_title}</h3>
                                <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.landing.safety_desc}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* About Airna */}
                <section id="about" className="py-12 md:py-20 scroll-mt-24">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            <div className="lg:col-span-6">
                                <h2 className={`heading-xl ${language === 'en' ? 'font-display' : ''}`}>{t.landing.about_title}</h2>
                                <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {t.landing.about_desc}
                                </p>
                            </div>
                            <div className="lg:col-span-6">
                                <div className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-xl p-5 md:p-6 shadow-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.landing.contact_title}</div>
                                            <div className="mt-1 text-sm md:text-base font-extrabold">Airna International Inc</div>
                                        </div>
                                        <a
                                            href="https://airnacybertech.great-site.net/"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-700 dark:text-brand-400 hover:underline"
                                        >
                                            <Globe size={16} />
                                            {t.landing.contact_website}
                                        </a>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                        <a href="tel:+93795074093" className="flex items-center gap-2 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                            <Phone size={16} className="text-emerald-500" />
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t.landing.contact_phone}</div>
                                                <div className="font-extrabold truncate">+93 795 074 093</div>
                                            </div>
                                        </a>
                                        <a href="mailto:airna.jobs@gmail.com" className="flex items-center gap-2 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                            <Mail size={16} className="text-brand-600" />
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t.landing.contact_email}</div>
                                                <div className="font-extrabold truncate">airna.jobs@gmail.com</div>
                                            </div>
                                        </a>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.landing.contact_desc}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Contact / CTA */}
                <section id="contact" className="py-12 md:py-20 bg-brand-950 relative overflow-hidden scroll-mt-24">
                    <div className="absolute inset-0 bg-brand-600/10" />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                        <div className="max-w-3xl">
                            <h2 className={`text-white heading-xl ${language === 'en' ? 'font-display' : ''}`}>{t.landing.cta_title}</h2>
                            <p className="mt-2 text-sm md:text-base text-slate-200/90">{t.landing.cta_desc}</p>
                        </div>
                        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
                            <Button onClick={() => setAppMode('auth')} size="lg" className="w-full sm:w-auto">
                                {t.landing.cta_primary}
                            </Button>
                            <Button onClick={() => setAppMode('auth')} size="lg" variant="glass" className="w-full sm:w-auto bg-white/10 hover:bg-white/20 border-white/20 text-white">
                                {t.landing.cta_secondary}
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="bg-slate-50 dark:bg-[#020617] border-t border-slate-200 dark:border-white/10 py-8 px-4 sm:px-6">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-500 to-blue-600 flex items-center justify-center text-white font-extrabold text-[12px] shadow-lg shadow-brand-500/25">
                                {language === 'fa' ? 'آ' : 'iT'}
                            </div>
                            <span className={`font-extrabold text-slate-900 dark:text-white ${language === 'en' ? 'font-display' : ''}`}>{t.brand}</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                            © {year} {t.brand}. {t.landing.footer_rights}
                        </p>
                    </div>
                </footer>
            </main>
        </div>
    );
};

