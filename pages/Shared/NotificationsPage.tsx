
import React from 'react';
import { Card } from '../../components/ui/Card';
import { Tag, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '../../store';
import { useI18n } from '../../services/useI18n';

export const NotificationsPage: React.FC = () => {
    const notifications = useAppStore((state) => state.notifications);
    const markAllNotificationsRead = useAppStore((state) => state.markAllNotificationsRead);
    const sortedNotifs = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
    const { t } = useI18n();

    return (
        <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-dark-50 dark:bg-dark-950 transition-colors duration-300">
            <header className="mb-6 md:mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 1.875rem)' }} className="font-bold text-dark-900 dark:text-white tracking-tight">{t.pages.notifications.title}</h1>
                    <p className="text-xs md:text-sm text-dark-500 dark:text-dark-400">{t.pages.notifications.desc}</p>
                </div>
                <button
                    onClick={markAllNotificationsRead}
                    className="text-sm text-brand-600 dark:text-brand-400 font-medium hover:text-brand-500"
                >
                    {t.pages.notifications.mark_all_read}
                </button>
            </header>

            <div className="space-y-3 sm:space-y-4 max-w-2xl">
                {sortedNotifs.map((notif) => (
                    <Card key={notif.id} className={`flex gap-3 sm:gap-4 p-4 sm:p-5 transition-all cursor-pointer border ${notif.read ? 'bg-slate-100/50 dark:bg-white/5 border-dark-200 dark:border-white/5 opacity-80 hover:opacity-100' : 'bg-white dark:bg-dark-800 border-brand-500/30 shadow-sm'}`}>
                        <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center border ${notif.type === 'promo' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500 dark:text-purple-400' :
                                notif.type === 'alert' ? 'bg-red-500/10 border-red-500/20 text-red-500 dark:text-red-400' :
                                    notif.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500 dark:text-green-400' :
                                        'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400'
                            }`}>
                            {notif.type === 'promo' && <Tag size={20} />}
                            {notif.type === 'alert' && <AlertTriangle size={20} />}
                            {notif.type === 'success' && <CheckCircle size={20} />}
                            {notif.type === 'system' && <Info size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5 sm:mb-1">
                                <h3 className={`font-bold text-sm sm:text-base truncate ${notif.read ? 'text-dark-500 dark:text-dark-300' : 'text-dark-900 dark:text-white'}`}>{notif.title}</h3>
                                {notif.read ? null : <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_#0ea5e9] shrink-0 mt-1.5 ml-2"></div>}
                            </div>
                            <p className="text-xs sm:text-sm text-dark-600 dark:text-dark-400 leading-relaxed mb-2 line-clamp-2 sm:line-clamp-none">{notif.message}</p>
                            <div className="flex items-center gap-1 text-[10px] text-dark-400 dark:text-dark-500 font-medium uppercase tracking-wider">
                                <Clock size={10} /> {new Date(notif.timestamp).toLocaleString()}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
