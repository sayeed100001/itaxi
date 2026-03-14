import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'glass' | 'danger' | 'ghost' | 'gradient';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    isLoading, 
    icon,
    className = '',
    ...props 
}) => {
    const baseStyles = "relative overflow-hidden rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-950 shadow-lg";
    
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 border-0 focus:ring-blue-500 hover:shadow-blue-500/30",
        secondary: "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-zinc-900/10 focus:ring-zinc-500",
        glass: "bg-white/10 dark:bg-white/5 backdrop-blur-xl text-zinc-900 dark:text-white border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 shadow-zinc-900/20 focus:ring-white/50",
        danger: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 shadow-red-500/20 focus:ring-red-500",
        ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shadow-none focus:ring-zinc-500",
        gradient: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-blue-500/30 focus:ring-blue-500 hover:shadow-blue-500/40"
    };

    const sizes = {
        // Mobile-first sizing: keep tap targets large, but avoid oversized typography on phones.
        sm: "px-3.5 py-2 text-sm h-9",
        md: "px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base h-11 sm:h-12",
        lg: "px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg h-12 sm:h-14 w-full"
    };

    return (
        <button 
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-80" />
            ) : (
                <>
                    {icon && <span className="opacity-90">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
};
