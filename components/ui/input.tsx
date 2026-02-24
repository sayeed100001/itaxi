import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input: React.FC<InputProps> = ({ 
    label, 
    error, 
    helperText, 
    className = '',
    ...props 
}) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <input
                className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    error ? 'border-red-500' : 'border-input'
                } ${className}`}
                {...props}
            />
            {helperText && !error && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {helperText}
                </p>
            )}
            {error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {error}
                </p>
            )}
        </div>
    );
};