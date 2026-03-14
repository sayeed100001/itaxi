import { Request, Response, NextFunction } from 'express';

export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (!roles.includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        next();
    };
};

export const requireOwnership = (resourceIdParam: string = 'id') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const resourceId = req.params[resourceIdParam];
        
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (user.role === 'admin') {
            return next();
        }
        
        if (user.id !== resourceId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        next();
    };
};
