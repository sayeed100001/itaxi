import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default_secret' || process.env.JWT_SECRET.length < 32)) {
  console.error('❌ FATAL: JWT_SECRET must be set and at least 32 chars in production');
  process.exit(1);
}

const config = {
  port: parseInt(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || (isProduction ? null : 'dev_secret_min_32_chars_for_local'),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  openrouteserviceApiKey: process.env.OPENROUTESERVICE_API_KEY,
  serviceName: process.env.SERVICE_NAME || 'unknown_service',
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || (isProduction ? (process.env.CLIENT_URL || 'https://itaxi.example.com') : '*'),
  apiVersion: process.env.API_VERSION || 'v1',
  database: {
    url: process.env.DATABASE_URL,
    logLevel: process.env.DATABASE_LOG_LEVEL || 'info',
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  },
  openrouteservice: {
    apiKey: process.env.OPENROUTESERVICE_API_KEY,
  },
  services: {
    authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
    rideServiceUrl: process.env.RIDE_SERVICE_URL || 'http://localhost:5002',
    paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:5003',
    dispatchServiceUrl: process.env.DISPATCH_SERVICE_URL || 'http://localhost:5004',
    walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:5005',
    notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5006',
    fraudServiceUrl: process.env.FRAUD_SERVICE_URL || 'http://localhost:5007',
    analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5008',
    corporateServiceUrl: process.env.CORPORATE_SERVICE_URL || 'http://localhost:5009',
    loyaltyServiceUrl: process.env.LOYALTY_SERVICE_URL || 'http://localhost:5010',
  }
};

export { config };