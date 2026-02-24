import React from 'react';
import { useAppStore } from '../../store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useAppStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 md:px-0">
            {toasts.map((toast) => (
                <div 
                    key={toast.id}
                    className="pointer-events-auto bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-5 fade-in duration-300"
                >
                    <div className="shrink-0 pt-0.5">
                        {toast.type === 'success' && <CheckCircle size={20} className="text-green-500 dark:text-green-400" />}
                        {toast.type === 'error' && <AlertCircle size={20} className="text-red-500 dark:text-red-400" />}
                        {toast.type === 'warning' && <AlertTriangle size={20} className="text-yellow-500 dark:text-yellow-400" />}
                        {toast.type === 'info' && <Info size={20} className="text-brand-500 dark:text-brand-400" />}
                    </div>
                    <div className="flex-1 text-sm font-medium leading-relaxed">
                        {toast.message}
                    </div>
                    <button 
                        onClick={() => removeToast(toast.id)}
                        className="text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};