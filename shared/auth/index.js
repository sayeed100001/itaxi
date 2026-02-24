import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '@shared/config';
import { logger } from '@shared/logger';

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    
    // Optionally validate user against auth service
    if (config.services.authServiceUrl) {
      try {
        const response = await axios.get(`${config.services.authServiceUrl}/api/validate`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'X-Correlation-ID': req.correlationId || 'unknown'
          }
        });
        req.user = { ...req.user, ...response.data.user };
      } catch (validationError) {
        logger.logWithContext('warn', 'Token validation failed', { 
          correlationId: req.correlationId,
          error: validationError.message 
        });
        // Continue with decoded token but log warning
      }
    }
    
    next();
  } catch (error) {
    logger.logWithContext('error', 'Authentication failed', { 
      correlationId: req.correlationId,
      error: error.message 
    });
    res.status(401).json({ error: error.message });
  }
};

// Enhanced authentication with refresh token support
const authenticateWithRefresh = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      // Try to verify the access token first
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch (tokenError) {
      // If access token is expired, check for refresh token
      const refreshToken = req.headers['x-refresh-token'];
      if (refreshToken) {
        // Call auth service to refresh token
        try {
          const refreshResponse = await axios.post(`${config.services.authServiceUrl}/api/refresh-token`, {
            refreshToken,
            userId: req.headers['x-user-id'] // Pass user ID to verify ownership
          }, {
            headers: { 'X-Correlation-ID': req.correlationId || 'unknown' }
          });
          
          req.freshToken = refreshResponse.data.data.accessToken;
          req.user = verifyToken(req.freshToken);
        } catch (refreshError) {
          throw new Error('Invalid or expired tokens');
        }
      } else {
        throw new Error('Invalid or expired token');
      }
    }
    
    // Optionally validate user against auth service
    if (config.services.authServiceUrl) {
      try {
        const response = await axios.get(`${config.services.authServiceUrl}/api/validate`, {
          headers: { 
            'Authorization': `Bearer ${req.freshToken || token}`,
            'X-Correlation-ID': req.correlationId || 'unknown'
          }
        });
        req.user = { ...req.user, ...response.data.user };
      } catch (validationError) {
        logger.logWithContext('warn', 'Token validation failed', { 
          correlationId: req.correlationId,
          error: validationError.message 
        });
        // Continue with decoded token but log warning
      }
    }
    
    next();
  } catch (error) {
    logger.logWithContext('error', 'Authentication failed', { 
      correlationId: req.correlationId,
      error: error.message 
    });
    res.status(401).json({ error: error.message });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

const requireRider = (req, res, next) => {
  if (!req.user || req.user.role !== 'RIDER') {
    return res.status(403).json({ error: 'Rider access required' });
  }
  next();
};

const requireDriver = (req, res, next) => {
  if (!req.user || req.user.role !== 'DRIVER') {
    return res.status(403).json({ error: 'Driver access required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export {
  authenticate,
  authenticateWithRefresh,
  authorize,
  requireRider,
  requireDriver,
  requireAdmin
};