import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rectangular' }) => {
    // Fixed: bg-slate-200 for light mode visibility, white/5 for dark mode.
    const baseStyles = "animate-pulse bg-slate-200 dark:bg-white/5 rounded-lg";
    
    const variants = {
        text: "h-4 w-full rounded",
        circular: "rounded-full",
        rectangular: "h-full w-full",
    };

    return (
        <div className={`${baseStyles} ${variants[variant]} ${className}`} />
    );
};