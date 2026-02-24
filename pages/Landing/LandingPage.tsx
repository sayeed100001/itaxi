import React from 'react';
import { useAppStore } from '../../store';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ArrowRight, Shield, Zap, Globe, Smartphone, Star, MapPin, ChevronDown, Moon, Sun, ArrowLeft } from 'lucide-react';
import { translations } from '../../constants/translations';

export const LandingPage: React.FC = () => {
    const { setAppMode, isDarkMode, toggleDarkMode, language, setLanguage } = useAppStore();
    const t = translations[language];
    const isRTL = language === 'fa';
    const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white overflow-hidden transition-colors duration-500">
            {/* Background Gradients */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-400/20 dark:bg-brand-600/20 rounded-[100%] blur-[120px] pointer-events-none opacity-60 dark:opacity-100" />
            <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-400/10 dark:bg-purple-600/10 rounded-[100%] blur-[120px] pointer-events-none opacity-60 dark:opacity-100" />

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-950/50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand-500/30">
                            {language === 'fa' ? 'آ' : 'iT'}
                         </div>
                         <span className="text-2xl font-bold tracking-tighter text-slate-900 dark:text-white">{t.brand}</span>
                    </div>
                    <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <a href="#" className="hover:text-brand-600 dark:hover:text-white transition-colors">{t.landing.nav_ride}</a>
                        <a href="#" className="hover:text-brand-600 dark:hover:text-white transition-colors">{t.landing.nav_drive}</a>
                        <a href="#" className="hover:text-brand-600 dark:hover:text-white transition-colors">{t.landing.nav_business}</a>
                        <a href="#" className="hover:text-brand-600 dark:hover:text-white transition-colors">{t.landing.nav_safety}</a>
                    </div>
                    <div className="flex gap-4 items-center">
                         <button onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')} className="font-bold text-xs uppercase text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                            {language === 'en' ? 'FA' : 'EN'}
                        </button>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                        <button onClick={toggleDarkMode} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                        <button onClick={() => setAppMode('auth')} className="text-sm font-medium text-slate-700 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{t.landing.login}</button>
                        <Button onClick={() => setAppMode('auth')} size="sm" className="shadow-brand-500/25">{t.auth.rider_signup}</Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
                <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 animate-in slide-in-from-left-8 duration-700 fade-in">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-wider shadow-sm">
                            <Zap size={12} className="fill-current" />
                            Next Gen Mobility
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-slate-900 dark:text-white">
                            {t.landing.tagline_prefix} <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-500">{t.landing.tagline_highlight}</span>
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
                            {t.landing.hero_desc}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button onClick={() => setAppMode('auth')} size="lg" className="h-14 text-lg px-8 shadow-brand-500/30">
                                {t.landing.get_ride} <ArrowIcon className="ms-2 rtl:rotate-180" />
                            </Button>
                            <Button variant="secondary" size="lg" className="h-14 text-lg px-8">
                                {t.landing.become_driver}
                            </Button>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-500 pt-4">
                            <div className="flex -space-x-2 rtl:space-x-reverse">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-50 dark:border-slate-950 bg-slate-300 dark:bg-slate-800" />
                                ))}
                            </div>
                            <p>{t.landing.trusted_by}</p>
                        </div>
                    </div>

                    <div className="relative animate-in slide-in-from-right-8 duration-700 fade-in delay-200" dir="ltr">
                        {/* Abstract Phone UI Visualization */}
                        <div className="relative z-10 w-full max-w-sm mx-auto aspect-[9/19] rounded-[3rem] border-8 border-slate-900 bg-slate-950 shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                            <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 rounded-b-xl z-20 w-32 mx-auto" />
                            <div className="h-full w-full bg-slate-100 dark:bg-slate-900 relative transition-colors duration-500">
                                {/* Map BG */}
                                <div className="absolute inset-0 opacity-30 dark:opacity-50 bg-slate-300 dark:bg-transparent transition-colors duration-500">
                                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                                        <defs>
                                            <pattern id="grid-sm" width="20" height="20" patternUnits="userSpaceOnUse">
                                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#64748b" strokeWidth="0.5" />
                                            </pattern>
                                        </defs>
                                        <rect width="100%" height="100%" fill="url(#grid-sm)" />
                                    </svg>
                                </div>
                                {/* Floating UI Elements */}
                                <div className="absolute bottom-8 left-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-lg">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                                            <MapPin size={20} />
                                        </div>
                                        <div>
                                            <div className="text-slate-900 dark:text-white font-bold text-sm">Downtown Office</div>
                                            <div className="text-slate-500 dark:text-slate-400 text-xs">4 mins away</div>
                                        </div>
                                    </div>
                                    <div className="h-10 bg-brand-600 rounded-lg w-full" />
                                </div>
                                <div className="absolute top-20 right-4 bg-white/20 dark:bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1 shadow-sm">
                                    <Star size={10} className="fill-yellow-400 text-yellow-400" /> 4.9
                                </div>
                            </div>
                        </div>
                        
                        {/* Decorative Blobs */}
                        <div className="absolute top-1/2 -right-12 w-24 h-24 bg-brand-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                        <div className="absolute bottom-12 -left-12 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20" />
                    </div>
                </div>
                
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-slate-400 dark:text-slate-600">
                    <ChevronDown size={24} />
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-white dark:bg-slate-900/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">{t.landing.why_choose}</h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">{t.landing.why_desc}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: <Shield className="text-brand-500" />, title: "Enterprise Security", desc: "End-to-end encryption and real-time monitoring for every ride." },
                            { icon: <Globe className="text-purple-500" />, title: "Global Coverage", desc: "Available in 400+ cities worldwide with localized support." },
                            { icon: <Smartphone className="text-pink-500" />, title: "Seamless Experience", desc: "One tap booking with instant driver matching algorithms." },
                        ].map((feature, idx) => (
                            <Card key={idx} className="p-8 hover:bg-slate-50 dark:hover:bg-white/5 transition-all group border-slate-100 dark:border-white/5 hover:border-brand-500/20 dark:hover:border-brand-500/20">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden bg-brand-950">
                <div className="absolute inset-0 bg-brand-600/10" />
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Ready to get started?</h2>
                    <p className="text-lg text-slate-300 mb-10">Join millions of riders and drivers on the world's most advanced platform.</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button onClick={() => setAppMode('auth')} size="lg" className="h-14 px-10 text-lg">Download App</Button>
                        <Button onClick={() => setAppMode('auth')} variant="glass" size="lg" className="h-14 px-10 text-lg bg-white/10 hover:bg-white/20 border-white/20 text-white">Driver Sign Up</Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-50 dark:bg-[#020617] border-t border-slate-200 dark:border-white/5 py-12 px-6 transition-colors duration-500">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
                             {language === 'fa' ? 'آ' : 'iT'}
                        </div>
                        <span className="font-bold text-lg text-slate-900 dark:text-white">{t.brand}</span>
                    </div>
                    <div className="text-slate-500 text-sm">
                        {t.landing.footer_rights}
                    </div>
                </div>
            </footer>
        </div>
    );
};