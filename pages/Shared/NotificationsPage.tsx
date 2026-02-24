import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Tag, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '../../store';

type FeedNotification = {
  id: string;
  type: 'promo' | 'system' | 'success' | 'alert';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
};

export const NotificationsPage: React.FC = () => {
  const addToast = useAppStore((state) => state.addToast);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/notifications/feed?limit=80', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.message || 'Failed to load notifications');
        }

        setNotifications(data.data || []);
      } catch (error: any) {
        addToast('error', error?.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [addToast]);

  const sortedNotifs = useMemo(
    () => [...notifications].sort((a, b) => b.timestamp - a.timestamp),
    [notifications]
  );

  const markAllReadLocal = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 transition-colors duration-300">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-white tracking-tight">Notifications</h1>
          <p className="text-dark-500 dark:text-dark-400">Live feed from backend events.</p>
        </div>
        <button
          onClick={markAllReadLocal}
          className="text-sm text-brand-600 dark:text-brand-400 font-medium hover:text-brand-500"
        >
          Mark all as read
        </button>
      </header>

      {loading ? (
        <Card className="p-6 text-sm text-dark-500">Loading notifications...</Card>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {sortedNotifs.map((notif) => (
            <Card
              key={notif.id}
              className={`flex gap-4 p-5 transition-all cursor-pointer border ${
                notif.read
                  ? 'bg-slate-100/50 dark:bg-white/5 border-dark-200 dark:border-white/5 opacity-80 hover:opacity-100'
                  : 'bg-white dark:bg-dark-800 border-brand-500/30 shadow-sm'
              }`}
            >
              <div
                className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center border ${
                  notif.type === 'promo'
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-500 dark:text-purple-400'
                    : notif.type === 'alert'
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 dark:text-red-400'
                    : notif.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-500 dark:text-green-400'
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400'
                }`}
              >
                {notif.type === 'promo' && <Tag size={20} />}
                {notif.type === 'alert' && <AlertTriangle size={20} />}
                {notif.type === 'success' && <CheckCircle size={20} />}
                {notif.type === 'system' && <Info size={20} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-bold text-base ${notif.read ? 'text-dark-500 dark:text-dark-300' : 'text-dark-900 dark:text-white'}`}>
                    {notif.title}
                  </h3>
                  {notif.read ? null : <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_#0ea5e9]" />}
                </div>
                <p className="text-sm text-dark-600 dark:text-dark-400 leading-relaxed mb-2">{notif.message}</p>
                <div className="flex items-center gap-1 text-[10px] text-dark-400 dark:text-dark-500 font-medium uppercase tracking-wider">
                  <Clock size={10} /> {new Date(notif.timestamp).toLocaleString()}
                </div>
              </div>
            </Card>
          ))}

          {sortedNotifs.length === 0 && (
            <Card className="p-6 text-sm text-dark-500">No notifications found.</Card>
          )}
        </div>
      )}
    </div>
  );
};
