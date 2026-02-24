import dotenv from 'dotenv';

dotenv.config();

// Validate critical secrets
const requiredSecrets = [
  'JWT_SECRET',
  'DATABASE_URL',
];

for (const secret of requiredSecrets) {
  if (!process.env[secret]) {
    console.error(`\n❌ FATAL ERROR: ${secret} is not set in environment variables.`);
    console.error(`Please copy .env.example to .env and set all required secrets.\n`);
    process.exit(1);
  }
}

const jwtSecret = process.env.JWT_SECRET as string;

// Prevent default/weak secrets in production
if (jwtSecret === 'default-secret' || 
    jwtSecret === 'your-super-secret-jwt-key-change-in-production' ||
    jwtSecret.length < 32) {
  console.error(`\n❌ FATAL ERROR: JWT_SECRET is insecure.`);
  console.error(`Generate a secure secret using: openssl rand -base64 32`);
  console.error(`Or use: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"\n`);
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL as string,
};
