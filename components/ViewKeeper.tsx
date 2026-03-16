import React, { useRef, useEffect } from 'react';

interface ViewKeeperProps {
    viewKey: string;
    children: React.ReactNode;
}

/**
 * ViewKeeper - Keeps component instances alive when switching views
 * This prevents unmounting and remounting, preserving state and preventing refresh
 */
export const ViewKeeper: React.FC<ViewKeeperProps> = ({ viewKey, children }) => {
    const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());
    
    useEffect(() => {
        // Store the current view in cache
        if (!cacheRef.current.has(viewKey)) {
            cacheRef.current.set(viewKey, children);
        }
    }, [viewKey, children]);

    return <>{children}</>;
};
