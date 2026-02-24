import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'elevated' | 'outline';
}

export const Card: React.FC<CardProps> = ({ children, className = '', variant = 'default', ...props }) => {
    const variantClasses = {
        default: 'shadow-sm',
        elevated: 'shadow-lg',
        outline: 'border-2',
    };
    
    return (
        <div 
            className={`rounded-xl border bg-card text-card-foreground shadow ${variantClasses[variant]} ${className}`} 
            {...props}
        >
            {children}
        </div>
    );
};

interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export const CardHeader: React.FC<CardSectionProps> = ({ children, className = '', ...props }) => (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>
        {children}
    </div>
);

export const CardTitle: React.FC<CardSectionProps> = ({ children, className = '', ...props }) => (
    <h3 className={`font-semibold leading-none tracking-tight ${className}`} {...props}>
        {children}
    </h3>
);

export const CardDescription: React.FC<CardSectionProps> = ({ children, className = '', ...props }) => (
    <p className={`text-sm text-muted-foreground ${className}`} {...props}>
        {children}
    </p>
);

export const CardContent: React.FC<CardSectionProps> = ({ children, className = '', ...props }) => (
    <div className={`p-6 pt-0 ${className}`} {...props}>
        {children}
    </div>
);

export const CardFooter: React.FC<CardSectionProps> = ({ children, className = '', ...props }) => (
    <div className={`flex items-center p-6 pt-0 ${className}`} {...props}>
        {children}
    </div>
);