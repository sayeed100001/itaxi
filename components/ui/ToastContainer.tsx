import React from 'react';
import { useAppStore } from '../../store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const ToastContainer: React.FC = () => {
    const toasts = useAppStore((state) => state.toasts);
    const removeToast = useAppStore((state) => state.removeToast);

    if (toasts.length === 0) return null;

    const getToastStyles = (type: string) => {
        switch(type) {
            case 'success':
                return 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-900 dark:text-green-100';
            case 'error':
                return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-900 dark:text-red-100';
            case 'warning':
                return 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-900 dark:text-yellow-100';
            case 'info':
                return 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-100';
            default:
                return 'bg-white dark:bg-dark-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 md:px-0">
            {toasts.map((toast, index) => (
                <div 
                    key={toast.id}
                    className={`pointer-events-auto backdrop-blur-xl border-2 p-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-5 fade-in duration-300 ${getToastStyles(toast.type)}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    <div className="shrink-0 pt-0.5">
                        {toast.type === 'success' && <CheckCircle size={22} className="text-green-600 dark:text-green-400" strokeWidth={2.5} />}
                        {toast.type === 'error' && <AlertCircle size={22} className="text-red-600 dark:text-red-400" strokeWidth={2.5} />}
                        {toast.type === 'warning' && <AlertTriangle size={22} className="text-yellow-600 dark:text-yellow-400" strokeWidth={2.5} />}
                        {toast.type === 'info' && <Info size={22} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />}
                    </div>
                    <div className="flex-1 text-sm font-bold leading-relaxed">
                        {toast.message}
                    </div>
                    <button 
                        onClick={() => removeToast(toast.id)}
                        className="text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>
            ))}
        </div>
    );
};