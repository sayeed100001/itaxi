// Import required modules using CommonJS
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const xss = require('xss');
const validator = require('validator');

// For csrf and express-fileupload, we'll use CommonJS imports
let csrf = null;
try {
  csrf = require('csurf');
} catch (error) {
  // csurf may not be installed, that's ok
  csrf = null;
}

let fileUpload = null;
try {
  fileUpload = require('express-fileupload');
} catch (error) {
  // express-fileupload may not be installed, that's ok
  fileUpload = null;
}

// Refresh token storage (in production, use Redis or database)
const refreshTokenStore = new Map();

// Security configuration
const SECURITY_CONFIG = {
  JWT_ACCESS_EXPIRY: '15m',           // 15 minutes for access tokens
  JWT_REFRESH_EXPIRY: '7d',          // 7 days for refresh tokens
  MAX_LOGIN_ATTEMPTS: 5,             // Max failed login attempts
  LOCKOUT_DURATION: 15 * 60 * 1000,  // Lockout for 15 minutes
  SESSION_TIMEOUT: 30 * 60 * 1000,   // Session timeout after 30 minutes
};

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https://api.stripe.com', 'https://graph.facebook.com'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  referrerPolicy: {
    policy: ['no-referrer'],
  },
});

// Rate limiting middleware
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Specific endpoint rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    error: 'Too many login attempts from this IP, please try again later.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 OTP requests per windowMs
  message: {
    error: 'Too many OTP requests from this IP, please try again later.',
    code: 'OTP_RATE_LIMIT_EXCEEDED'
  },
});

// Slow down repeated requests
const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // Begin slowing down after 10 requests
  delayMs: 500, // Slow down by 500ms per request after delayAfter
});

// Device fingerprinting middleware
const deviceFingerprint = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress ||
             (req.connection.socket ? req.connection.socket.remoteAddress : null);
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // Create a hash of device characteristics
  const fingerprintData = `${ip}-${userAgent}-${acceptLanguage}-${acceptEncoding}`;
  const fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');
  
  req.deviceFingerprint = fingerprint;
  next();
};

// Phone masking utility
const maskPhone = (phone) => {
  if (!phone) return phone;
  const strPhone = String(phone);
  if (strPhone.length <= 4) return '*'.repeat(strPhone.length);
  return strPhone.substring(0, 2) + '*'.repeat(strPhone.length - 4) + strPhone.substring(strPhone.length - 2);
};

// IP blocking system
const blockedIPs = new Set(); // In production, use Redis or database
let suspiciousIPs = new Map(); // Track suspicious activity counts

const blockIP = (ip) => {
  blockedIPs.add(ip);
  // Remove from suspicious IPs if present
  suspiciousIPs.delete(ip);
};

const isIPBlocked = (ip) => blockedIPs.has(ip);

const incrementSuspiciousActivity = (ip) => {
  const currentCount = suspiciousIPs.get(ip) || 0;
  const newCount = currentCount + 1;
  
  if (newCount >= 5) { // Block after 5 suspicious activities
    blockIP(ip);
    return true;
  }
  
  suspiciousIPs.set(ip, newCount);
  return false;
};

// Suspicious activity detector
const detectSuspiciousActivity = (req) => {
  const suspiciousPatterns = [
    req.headers['user-agent']?.includes('bot') || req.headers['user-agent']?.includes('crawler'),
    req.body?.password === req.body?.email, // Weak password
    req.body?.email?.length > 100, // Extremely long email
    req.path.includes('..'), // Path traversal attempt
    req.query?.password, // Password in URL
  ];
  
  return suspiciousPatterns.filter(Boolean).length > 0;
};

// Security middleware that checks for suspicious activity
const securityCheck = (req, res, next) => {
  // In local/dev environments, don't permanently block localhost traffic.
  // This keeps integration and smoke tests from self-locking the machine.
  const isLocalIp = req.ip === '127.0.0.1' ||
                    req.ip === '::1' ||
                    req.ip === '::ffff:127.0.0.1';
  if (process.env.NODE_ENV !== 'production' && isLocalIp) {
    return next();
  }

  // Check if IP is blocked
  if (isIPBlocked(req.ip)) {
    return res.status(403).json({
      error: 'Access denied. Your IP has been blocked due to suspicious activity.',
      code: 'IP_BLOCKED'
    });
  }

  // Detect suspicious activity
  if (detectSuspiciousActivity(req)) {
    const shouldBlock = incrementSuspiciousActivity(req.ip);
    if (shouldBlock) {
      return res.status(403).json({
        error: 'Access denied. Your IP has been blocked due to suspicious activity.',
        code: 'IP_BLOCKED_FOR_SUSPICIOUS_ACTIVITY'
      });
    }
  }

  next();
};

// XSS protection middleware
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    // Sanitize all string values in the body
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    });
  }
  
  if (req.query) {
    // Sanitize query parameters
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    });
  }
  
  next();
};

// Input validation middleware
const validateInput = (req, res, next) => {
  if (req.body && req.body.email && !validator.isEmail(req.body.email)) {
    return res.status(400).json({
      error: 'Invalid email format',
      code: 'INVALID_EMAIL'
    });
  }
  
  if (req.body && req.body.phone && !validator.isMobilePhone(req.body.phone)) {
    return res.status(400).json({
      error: 'Invalid phone number format',
      code: 'INVALID_PHONE'
    });
  }
  
  next();
};

// Token refresh middleware
const refreshAccessToken = async (refreshToken, userId) => {
  // Verify refresh token
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret_default');
    
    // Check if token exists in store
    if (!refreshTokenStore.has(decoded.jti) || refreshTokenStore.get(decoded.jti).userId !== userId) {
      throw new Error('Invalid refresh token');
    }
    
    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.JWT_ACCESS_EXPIRY }
    );
    
    return newAccessToken;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Secure token generation
const generateSecureTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: SECURITY_CONFIG.JWT_ACCESS_EXPIRY });
  const refreshTokenId = crypto.randomBytes(40).toString('hex');
  const refreshToken = jwt.sign(
    { ...payload, jti: refreshTokenId },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret_default',
    { expiresIn: SECURITY_CONFIG.JWT_REFRESH_EXPIRY }
  );
  
  // Store refresh token
  refreshTokenStore.set(refreshTokenId, {
    userId: payload.userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SECURITY_CONFIG.JWT_REFRESH_EXPIRY * 1000
  });
  
  return { accessToken, refreshToken };
};

// Clean expired refresh tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [jti, tokenInfo] of refreshTokenStore.entries()) {
    if (now > tokenInfo.expiresAt) {
      refreshTokenStore.delete(jti);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

// Session timeout middleware
const sessionTimeout = (req, res, next) => {
  const now = Date.now();
  const lastActivity = req.session?.lastActivity || now;
  
  if (now - lastActivity > SECURITY_CONFIG.SESSION_TIMEOUT) {
    return res.status(401).json({
      error: 'Session expired',
      code: 'SESSION_EXPIRED'
    });
  }
  
  // Update last activity
  if (req.session) {
    req.session.lastActivity = now;
  }
  
  next();
};

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      process.env.FRONTEND_URL,
      process.env.ADMIN_FRONTEND_URL
    ].filter(Boolean); // Remove undefined values
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 
    'Accept', 'Authorization', 'X-Device-Fingerprint'
  ]
};

// Secrets validation at boot
const validateSecrets = () => {
  const requiredSecrets = [
    'JWT_SECRET',
    'DATABASE_URL'
  ];
  const optionalInDev = ['JWT_REFRESH_SECRET', 'STRIPE_SECRET_KEY', 'REDIS_URL'];
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    requiredSecrets.push(...optionalInDev);
  }

  const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);

  if (missingSecrets.length > 0) {
    console.error(`Missing required secrets: ${missingSecrets.join(', ')}`);
    console.error('Please check your .env file and environment variables');
    process.exit(1);
  }

  if (!isProduction) {
    const missingOptional = optionalInDev.filter(secret => !process.env[secret]);
    if (missingOptional.length > 0) {
      console.warn(`Optional integrations are not configured in development: ${missingOptional.join(', ')}`);
    }
  }

  console.log('All required secrets are present');
};

// Request size limitingconst maxSize = '10mb'; // Use a default size
const sizeLimiter = fileUpload ? fileUpload({ 
  limits: { fileSize: maxSize },
  abortOnLimit: true
}) : null;

// Export all security utilities
module.exports = {
  securityHeaders,
  globalRateLimiter,
  loginLimiter,
  otpLimiter,
  slowDownMiddleware,
  deviceFingerprint,
  maskPhone,
  blockIP,
  isIPBlocked,
  incrementSuspiciousActivity,
  securityCheck,
  sanitizeInput,
  validateInput,
  refreshAccessToken,
  generateSecureTokens,
  sessionTimeout,
  corsOptions,
  validateSecrets,
  SECURITY_CONFIG
};

