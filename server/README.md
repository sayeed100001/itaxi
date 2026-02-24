# iTaxi Backend Server

Production-ready backend API built with Node.js, Express, TypeScript, Prisma, and MySQL.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment

**CRITICAL: Generate Secure Secrets**

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

**Generate JWT Secret (REQUIRED):**
```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Using UUID
node -e "console.log(require('crypto').randomUUID() + require('crypto').randomUUID())"
```

**Generate WhatsApp Verify Token:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Update `.env` with:**
- `DATABASE_URL` - Your MySQL connection string
- `JWT_SECRET` - Generated secure secret (min 32 characters)
- `CLIENT_URL` - Your frontend URL
- `WHATSAPP_PHONE_NUMBER_ID` - From Meta Business Suite
- `WHATSAPP_ACCESS_TOKEN` - From Meta Business Suite
- `WHATSAPP_VERIFY_TOKEN` - Generated random token
- `STRIPE_SECRET_KEY` - From Stripe Dashboard
- `OPENROUTESERVICE_API_KEY` - From openrouteservice.org

**⚠️ NEVER commit `.env` to version control!**

### Secret Rotation

**JWT Secret Rotation (Recommended: Every 90 days)**
```bash
# 1. Generate new secret
new_secret=$(openssl rand -base64 32)

# 2. Update .env with new secret
echo "JWT_SECRET=$new_secret" >> .env

# 3. Restart server
npm run build && npm start

# 4. All users will need to re-authenticate
```

**Stripe Webhook Secret Rotation:**
```bash
# 1. Go to Stripe Dashboard → Webhooks
# 2. Roll webhook signing secret
# 3. Update STRIPE_WEBHOOK_SECRET in .env
# 4. Restart server
```

**WhatsApp Token Rotation:**
```bash
# 1. Go to Meta Business Suite → WhatsApp API
# 2. Generate new access token
# 3. Update WHATSAPP_ACCESS_TOKEN in .env
# 4. Restart server (no downtime)
```

### 3. Setup Database
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Start Server
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Trips
- `POST /api/trips` - Create new trip
- `GET /api/trips` - Get user trips
- `GET /api/trips/:tripId` - Get trip details
- `POST /api/trips/:tripId/accept` - Accept trip (driver)
- `PATCH /api/trips/:tripId/status` - Update trip status

### Drivers
- `POST /api/drivers` - Create driver profile
- `GET /api/drivers/me` - Get driver profile
- `GET /api/drivers/available` - Get available drivers
- `PATCH /api/drivers/status` - Update driver status
- `PATCH /api/drivers/location` - Update driver location

### Transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - Get user transactions
- `GET /api/transactions/balance` - Get user balance

## WebSocket Events

### Client → Server
- `driver:location` - Update driver location
- `trip:request` - Request new trip
- `trip:accept` - Accept trip
- `trip:status` - Update trip status

### Server → Client
- `driver:location:update` - Driver location updated
- `trip:new` - New trip request
- `trip:accepted` - Trip accepted
- `trip:status:update` - Trip status updated

## Database Schema

- **User** - User accounts (riders, drivers, admins)
- **Driver** - Driver profiles and settings
- **Trip** - Ride records
- **Transaction** - Payment transactions
- **DriverLocation** - Real-time driver locations

## Tech Stack

- Node.js + Express
- TypeScript
- Prisma ORM
- MySQL
- Socket.IO (WebSocket)
- JWT Authentication
- Zod Validation
