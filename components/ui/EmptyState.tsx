import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, actionLabel, onAction }) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 flex items-center justify-center mb-6 shadow-inner transition-colors">
                <Icon size={40} className="text-slate-500 dark:text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">{description}</p>
            {actionLabel && onAction && (
                <Button variant="secondary" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};