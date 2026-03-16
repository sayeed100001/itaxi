import { useRef, useEffect } from 'react';
import { useAppStore } from '../store';

/**
 * Custom hook to prevent unnecessary re-renders by using shallow comparison
 * This ensures components only re-render when their specific data changes
 */
export const useStableSelector = <T,>(selector: (state: any) => T): T => {
    const value = useAppStore(selector);
    const prevValueRef = useRef<T>(value);

    useEffect(() => {
        prevValueRef.current = value;
    });

    // Simple shallow comparison for objects
    if (typeof value === 'object' && value !== null && typeof prevValueRef.current === 'object' && prevValueRef.current !== null) {
        const keys1 = Object.keys(value);
        const keys2 = Object.keys(prevValueRef.current);
        
        if (keys1.length === keys2.length && keys1.every(key => (value as any)[key] === (prevValueRef.current as any)[key])) {
            return prevValueRef.current;
        }
    }

    return value;
};
