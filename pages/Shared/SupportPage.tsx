
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MessageCircle, Phone, ChevronDown, ChevronUp, Search, FileText } from 'lucide-react';
import { useAppStore } from '../../store';
import { useI18n } from '../../services/useI18n';

export const SupportPage: React.FC = () => {
    const currentRole = useAppStore((state) => state.currentRole);
    const addToast = useAppStore((state) => state.addToast);
    const openChat = useAppStore((state) => state.openChat);
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const { t, tx } = useI18n();

    const handleSOS = () => {
        addToast('error', t.pages.support.toast_sos);
    };

    const handleChat = () => {
        openChat('support_agent', t.pages.support.agent_name, t.pages.support.agent_role);
    };

    const audience = currentRole === 'driver' ? t.pages.support.audience_partners : t.pages.support.audience_riders;
    const faqs = (t.pages.support.faqs || []) as Array<{ q: string; a: string }>;

    return (
        <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-dark-50 dark:bg-dark-950 pb-24 transition-colors duration-300">
            <header className="mb-6 md:mb-8 text-center md:text-left">
                <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 1.875rem)' }} className="font-bold text-dark-900 dark:text-white mb-1">{t.pages.support.title}</h1>
                <p className="text-xs md:text-sm text-dark-500 dark:text-dark-400">{tx('pages.support.subtitle', { audience })}</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
                <Card
                    onClick={handleChat}
                    className="flex flex-col items-center text-center hover:bg-white dark:hover:bg-white/5 transition-colors cursor-pointer group shadow-sm hover:shadow-md p-5"
                >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                        <MessageCircle size={22} />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-dark-900 dark:text-white mb-1">{t.pages.support.live_chat_title}</h3>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">{t.pages.support.live_chat_desc}</p>
                    <Button variant="secondary" size="sm">{t.pages.support.live_chat_cta}</Button>
                </Card>

                <Card className="flex flex-col items-center text-center hover:bg-white dark:hover:bg-white/5 transition-colors cursor-pointer group shadow-sm hover:shadow-md p-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                        <Phone size={22} />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-dark-900 dark:text-white mb-1">{t.pages.support.emergency_title}</h3>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">{t.pages.support.emergency_desc}</p>
                    <Button variant="danger" size="sm" onClick={handleSOS}>{t.pages.support.emergency_cta}</Button>
                </Card>

                <Card className="flex flex-col items-center text-center hover:bg-white dark:hover:bg-white/5 transition-colors cursor-pointer group shadow-sm hover:shadow-md p-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                        <FileText size={22} />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-dark-900 dark:text-white mb-1">{t.pages.support.tickets_title}</h3>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">{t.pages.support.tickets_desc}</p>
                    <Button variant="secondary" size="sm">{t.pages.support.tickets_cta}</Button>
                </Card>
            </div>

            <div className="max-w-3xl mx-auto">
                <div className="relative mb-8">
                    <Search className="absolute left-4 top-3.5 text-dark-400" size={20} />
                    <input
                        type="text"
                        placeholder={t.pages.support.search_placeholder}
                        className="w-full bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-dark-900 dark:text-white placeholder:text-dark-400 dark:placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all shadow-sm"
                    />
                </div>

                <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">{t.pages.support.faq_title}</h2>
                <div className="space-y-3">
                    {faqs.map((faq, idx) => (
                        <div key={idx} className="bg-white dark:bg-white/5 border border-dark-200 dark:border-white/5 rounded-xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-dark-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <span className="font-medium text-dark-900 dark:text-dark-200">{faq.q}</span>
                                {openFaq === idx ? <ChevronUp size={18} className="text-brand-500 dark:text-brand-400" /> : <ChevronDown size={18} className="text-dark-400 dark:text-dark-500" />}
                            </button>
                            {openFaq === idx && (
                                <div className="px-4 pb-4 text-sm text-dark-600 dark:text-dark-400 animate-in slide-in-from-top-2 duration-200 leading-relaxed">
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
