
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { MessageCircle, Search, Phone } from 'lucide-react';
import { useAppStore } from '../../store';
import { apiFetch } from '../../services/api';
import { useI18n } from '../../services/useI18n';

export const MessagesPage: React.FC = () => {
    const openChat = useAppStore((state) => state.openChat);
    const addToast = useAppStore((state) => state.addToast);
    const { t } = useI18n();

    const [threads, setThreads] = useState<Array<{
        id: string;
        name: string;
        role: string;
        phone?: string | null;
        lastMessage?: string;
        lastAt?: string | null;
        unread?: number;
        pinned?: boolean;
    }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadThreads = async () => {
            setIsLoading(true);
            try {
                const res = await apiFetch('/api/chat/threads');
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = await res.json();
                if (!cancelled) {
                    setThreads(Array.isArray(data) ? data : []);
                }
            } catch (e) {
                console.error('Failed to load chat threads:', e);
                addToast('error', t.pages.messages.toast_failed_load);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadThreads();
        return () => {
            cancelled = true;
        };
    }, [addToast]);

    const filteredThreads = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return threads;
        return threads.filter(t =>
            (t.name || '').toLowerCase().includes(q) ||
            (t.role || '').toLowerCase().includes(q) ||
            (t.lastMessage || '').toLowerCase().includes(q)
        );
    }, [threads, search]);

    const formatTime = (iso?: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (!Number.isFinite(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleOpenChat = (chat: any) => {
        setThreads(prev => prev.map(t => t.id === chat.id ? { ...t, unread: 0 } : t));
        openChat(chat.id.toString(), chat.name, chat.role);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-dark-50 dark:bg-dark-950 transition-colors duration-300 pb-24">
            <header className="mb-5 md:mb-6">
                <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 1.875rem)' }} className="font-bold text-dark-900 dark:text-white mb-1">{t.pages.messages.title}</h1>
                <p className="text-xs md:text-sm text-dark-500 dark:text-dark-400">{t.pages.messages.desc}</p>
            </header>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-dark-400" size={20} />
                <input
                    type="text"
                    placeholder={t.pages.messages.search_placeholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-dark-900 dark:text-white placeholder:text-dark-400 dark:placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all shadow-sm"
                />
            </div>

            {isLoading ? (
                <div className="py-10 text-center text-dark-500 dark:text-dark-400">{t.pages.messages.loading}</div>
            ) : filteredThreads.length === 0 ? (
                <div className="py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <MessageCircle size={26} className="text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="font-bold text-dark-900 dark:text-white">{t.pages.messages.empty_title}</div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 mt-1">{t.pages.messages.empty_desc}</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredThreads.map((thread) => (
                        <Card
                            key={thread.id}
                            onClick={() => handleOpenChat(thread)}
                            className="flex items-center gap-4 p-4 hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-colors group border-transparent hover:border-dark-100 dark:hover:border-white/5"
                        >
                            <div className="relative">
                                <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(thread.name || 'User')}&background=2563eb&color=fff`}
                                    alt={thread.name}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                                {(thread.unread || 0) > 0 && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold border-2 border-white dark:border-dark-900">
                                        {(thread.unread || 0) > 9 ? '9+' : (thread.unread || 0)}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h3 className={`font-bold text-sm sm:text-base truncate ${(thread.unread || 0) > 0 ? 'text-dark-900 dark:text-white' : 'text-dark-700 dark:text-dark-200'}`}>
                                        {thread.name}
                                    </h3>
                                    <span className="text-[10px] sm:text-xs text-dark-400 dark:text-dark-500 whitespace-nowrap ml-2">{formatTime(thread.lastAt)}</span>
                                </div>
                                <p className={`text-xs sm:text-sm truncate ${(thread.unread || 0) > 0 ? 'text-dark-900 dark:text-white font-medium' : 'text-dark-500 dark:text-dark-400'}`}>
                                    {thread.lastMessage || ''}
                                </p>
                            </div>
                            <div className="hidden group-hover:flex items-center gap-2">
                                {thread.phone && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`tel:${thread.phone}`);
                                        }}
                                        className="p-2 rounded-full bg-dark-100 dark:bg-white/10 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/20 transition-colors"
                                        title={t.pages.messages.call}
                                    >
                                        <Phone size={18} />
                                    </button>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
