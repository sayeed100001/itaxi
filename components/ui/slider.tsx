import React from 'react';

interface SliderProps {
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export const Slider: React.FC<SliderProps> = ({ 
    label, 
    min = 0, 
    max = 100, 
    step = 1, 
    value, 
    onChange, 
    className = '',
}) => {
    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    {label} ({value})
                </label>
            )}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>{min}</span>
                <span>{max}</span>
            </div>
        </div>
    );
};