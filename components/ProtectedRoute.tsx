import React, { useEffect } from 'react';
import { useAppStore } from '../store';
import { jwtDecode } from 'jwt-decode';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

interface JWTPayload {
    id: string;
    role: string;
    iat: number;
    exp: number;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, logout, addToast } = useAppStore();

    useEffect(() => {
        const token = localStorage.getItem('token');
        
        if (!token || !user) {
            addToast('error', 'Authentication required');
            logout();
            return;
        }

        try {
            const decoded = jwtDecode<JWTPayload>(token);

            if (decoded.exp * 1000 < Date.now()) {
                addToast('error', 'Session expired. Please login again.');
                logout();
                return;
            }

            const jwtRole = decoded.role;

            // Admin token may inspect all portals in UI, but backend
            // authorization is still enforced by JWT role.
            const isAdminToken = jwtRole === 'ADMIN';

            if (!allowedRoles.includes(jwtRole) && !isAdminToken) {
                addToast('error', 'Access denied. Insufficient permissions.');
                logout();
                return;
            }

            // For non-admin users, enforce strict role match.
            if (!isAdminToken && user.role !== jwtRole) {
                addToast('error', 'Role mismatch detected. Please login again.');
                logout();
                return;
            }

        } catch {
            addToast('error', 'Invalid authentication token');
            logout();
        }
    }, [user, allowedRoles, logout, addToast]);

    return <>{children}</>;
};
