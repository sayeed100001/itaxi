# iTaxi - Premium Ride-Hailing Platform

Full-stack ride-hailing application with real-time features, payment processing, and enterprise-grade security.

## 🚀 Features

- **Real-time Tracking** - Socket.IO for live driver locations
- **OTP Authentication** - Secure JWT-based authentication
- **Payment Processing** - Stripe integration for wallet top-ups and payouts
- **Route Planning** - OpenRouteService integration
- **Multi-Role System** - Rider, Driver, and Admin dashboards
- **Credit System** - Driver credit packages with admin approval workflow (1 credit = 1 AFN)
- **Messaging System** - In-app and WhatsApp messaging between all roles
- **Document Management** - Driver document upload and admin verification
- **Production Ready** - Security hardened with Helmet, CORS, rate limiting

## 📋 Tech Stack

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- Zustand (state management)
- Leaflet (maps)
- Socket.IO Client
- Recharts (analytics)

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + MySQL
- Socket.IO (real-time)
- JWT Authentication
- Stripe (payments)
- Winston (logging)
- Zod (validation)

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your configuration
npm run prisma:migrate
npm run dev
```

### Frontend Setup
```bash
npm install
cp .env.example .env.local
# Edit .env.local if needed
npm run dev
```

## Runtime Architecture (Important)

This repository contains two backend styles:

1. **Monolith API (default runtime)**  
Frontend (`/api` + Socket.IO) connects to `server/src/*` on port `5000`.

2. **Microservices stack (`services/*`)**  
This is a separate runtime path and requires matching service contracts and schema.

For local development and current frontend pages, use the **monolith path**:

- `npm run dev` at repo root (frontend + `server`)
- Vite proxy forwards `/api` to `http://localhost:5000`

## 📦 Build for Production

### Backend
```bash
cd server
npm install --production
npm run build
npm start
```

### Frontend
```bash
npm install
npm run build:prod
```

## 🚢 Deployment

See [DEPLOYMENT_GUIDE.txt](DEPLOYMENT_GUIDE.txt) for detailed instructions.

### Quick Deploy
```bash
# Automated deployment
chmod +x deploy.sh
./deploy.sh

# Or Windows
deploy.bat
```

### Deployment Options
1. **VPS** - Full control with PM2 + Nginx
2. **cPanel** - Shared hosting with Node.js support
3. **Cloud** - Render, Railway, Heroku

## 📚 Documentation

- [DEPLOYMENT_GUIDE.txt](DEPLOYMENT_GUIDE.txt) - Complete deployment guide
- [DEPLOY_QUICK_START.txt](DEPLOY_QUICK_START.txt) - Quick deployment checklist
- [PRODUCTION_HARDENING.txt](server/PRODUCTION_HARDENING.txt) - Security implementation
- [README_HARDENING.md](server/README_HARDENING.md) - Security features

## 🔒 Security Features

- ✅ Helmet (HTTP security headers)
- ✅ CORS (cross-origin protection)
- ✅ Rate limiting (DDoS protection)
- ✅ Input validation (Zod schemas)
- ✅ JWT authentication
- ✅ Error boundaries
- ✅ Structured logging

## 🧪 Testing

### Quick System Test
```bash
.\test-system.bat  # Windows - validates all fixes
```

### Manual Testing
1. **Landing Page**: Open `http://localhost:3000` in incognito → Should show landing page
2. **Admin Login**: Use +93700000000 / admin123
3. **Admin Taxi Request**: Navigate to home, request ride → Should work without 403 error
4. **Rider Login**: Use +93700000001 (OTP: any 6 digits)
5. **Driver Login**: Use +93700000010 (OTP: any 6 digits)

### Security Tests
```bash
cd server
.\test-security.bat  # Windows
./test-security.sh   # Linux/Mac
```

## 📝 Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=5001
DATABASE_URL=mysql://user:pass@host:3306/itaxi
JWT_SECRET=your-secret-key
CLIENT_URL=https://yourdomain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
OPENROUTESERVICE_API_KEY=your_key
```

### Frontend (.env.local)
```env
GEMINI_API_KEY=your_key_here
```

## 🗂️ Project Structure

```
itaxi/
├── components/          # React components
├── pages/              # Page components
├── services/           # API services
├── server/             # Backend application
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middlewares/
│   │   └── config/
│   └── prisma/         # Database schema
├── deploy.sh           # Deployment script
├── ecosystem.config.js # PM2 configuration
└── nginx.conf          # Nginx configuration
```

## 🔧 Scripts

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:prod` - Optimized production build
- `npm run serve` - Preview production build

### Backend
- `npm run dev` - Start development server
- `npm run build` - Build TypeScript
- `npm start` - Start production server
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:generate` - Generate Prisma client

## 📡 API Routes

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/admin/login` - Admin password login

### Trips
- `POST /api/trips` - Create trip (Rider/Admin)
- `GET /api/trips` - Get user trips
- `GET /api/trips/:tripId` - Get trip details
- `PATCH /api/trips/:tripId/status` - Update trip status
- `POST /api/trips/:tripId/accept` - Accept trip (Driver)
- `GET /api/trips/:tripId/messages` - Get trip messages
- `POST /api/trips/:tripId/messages` - Send trip message
- `POST /api/trips/:tripId/rate` - Rate trip

### Driver Management
- `GET /api/drivers/me` - Get driver profile
- `PATCH /api/drivers/status` - Update driver status (ONLINE/OFFLINE/BUSY)
- `PATCH /api/drivers/location` - Update driver location
- `GET /api/drivers/credit-status` - Get credit balance
- `GET /api/drivers/credit-packages` - Get available credit packages
- `POST /api/drivers/credit-request` - Request credit purchase
- `GET /api/drivers/credit-requests` - Get my credit requests
- `GET /api/drivers/earnings/summary` - Get earnings summary
- `GET /api/drivers/earnings/daily` - Get daily earnings chart
- `GET /api/drivers/profile` - Get driver profile with documents
- `PUT /api/drivers/profile` - Update driver profile
- `POST /api/drivers/documents` - Upload document

### Admin - Driver Credits
- `GET /api/admin/driver-credits/stats/credit-stats` - Get total revenue & credit stats
- `GET /api/admin/driver-credits/purchase-requests` - Get all credit requests
- `POST /api/admin/driver-credits/purchase-requests/:id/approve` - Approve credit request
- `POST /api/admin/driver-credits/purchase-requests/:id/reject` - Reject credit request
- `GET /api/admin/driver-credits/packages` - Get credit packages
- `POST /api/admin/driver-credits/packages` - Create credit package
- `POST /api/admin/driver-credits/driver/:driverId/add` - Manually add credits
- `POST /api/admin/driver-credits/driver/:driverId/deduct` - Manually deduct credits

### Admin - Drivers
- `GET /api/admin/drivers` - Get all drivers (with filters: city, province, status)
- `GET /api/admin/drivers/by-city` - Get drivers grouped by city
- `GET /api/admin/drivers/stats` - Get driver statistics
- `PATCH /api/admin/drivers/:id` - Update driver
- `PATCH /api/admin/drivers/:id/toggle-status` - Toggle driver status

### Messaging
- `POST /api/messages/admin/to-driver` - Admin send message to driver
- `POST /api/messages/admin/to-rider` - Admin send message to rider
- `POST /api/messages/driver/to-admin` - Driver send message to admin
- `POST /api/messages/rider/to-admin` - Rider send message to admin
- `GET /api/messages/admin/conversations` - Get all admin conversations
- `GET /api/messages/admin/driver/:driverId` - Get admin-driver messages
- `GET /api/messages/admin/rider/:riderId` - Get admin-rider messages
- `GET /api/messages/driver/admin-messages` - Get driver's messages with admin
- `GET /api/messages/rider/admin-messages` - Get rider's messages with admin

### Payments
- `POST /api/stripe/create-checkout-session` - Create Stripe checkout
- `POST /api/stripe/webhook` - Stripe webhook handler
- `GET /api/transactions` - Get user transactions

### Places & Routing
- `GET /api/places/search` - Search Afghanistan places
- `GET /api/places/cities` - Get all cities
- `GET /api/places/provinces` - Get all provinces
- `POST /api/routing/calculate` - Calculate route and fare

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5001 | xargs kill -9
```

### Database Connection Failed
- Verify DATABASE_URL in .env
- Check MySQL is running
- Test connection: `mysql -u user -p -h host database`

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist`
- Update dependencies: `npm update`

## 📊 Performance

- Optimized Vite build with code splitting
- Gzip compression enabled
- Static asset caching
- Database connection pooling
- PM2 cluster mode support

## 🎯 System Features Summary

### Credit System (1 Credit = 1 AFN)
- Drivers purchase credits to receive ride requests
- Admin approval workflow for all purchases
- Automatic balance updates and expiry management
- Complete revenue tracking: totalRevenue = sum of approved amountAfn
- Transaction history in DriverCreditLedger table

### Messaging System
- Admin ↔ Driver: IN_APP and WHATSAPP channels
- Admin ↔ Rider: IN_APP and WHATSAPP channels  
- Driver ↔ Rider: Trip-based messaging with both channels
- Real-time Socket.IO notifications
- Complete message history in AdminDriverMessage, AdminRiderMessage, TripMessage tables
- WhatsApp delivery status tracking

### Database Tables
- CreditPurchaseRequest: Driver credit requests (PENDING/APPROVED/REJECTED)
- CreditPackage: Available packages (name, priceAfn, credits, durationDays)
- DriverCreditLedger: Complete transaction history
- AdminDriverMessage: Admin-Driver conversations
- AdminRiderMessage: Admin-Rider conversations
- TripMessage: Driver-Rider trip messages
- DriverDocument: Document uploads with approval workflowe connection pooling
- PM2 cluster mode support

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature/name`
5. Submit pull request

## 📄 License

Private - All rights reserved

## 👥 Support

For issues and questions:
- Check documentation in `/docs`
- Review troubleshooting guides
- Check server logs: `pm2 logs itaxi-api`

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Push notifications
- [ ] In-app chat
- [ ] Driver ratings system

## ✅ Status

**Production Ready** - All features implemented and tested.

- Backend: ✅ Complete
- Frontend: ✅ Complete
- Security: ✅ Hardened
- Deployment: ✅ Ready
- Documentation: ✅ Complete
- **System Audit**: ✅ Passed (See [SYSTEM_AUDIT_FIXES.md](SYSTEM_AUDIT_FIXES.md))

### Recent Fixes (Latest)

✅ **Landing Page Flow**: Fixed bypass issue - new users now see landing page  
✅ **Admin Taxi Request**: Admins can now request rides for dispatch/testing  
✅ **Role Authorization**: Proper RBAC enforcement across frontend and backend  
✅ **Session Management**: Clean logout with proper state reset  
✅ **Credit System**: Complete driver credit purchase workflow with admin approval (1 credit = 1 AFN)  
✅ **Messaging System**: Real-time messaging between Admin↔Driver, Admin↔Rider, Driver↔Rider via in-app and WhatsApp  
✅ **Document Management**: Driver document upload with admin review and status tracking  
✅ **Revenue Tracking**: Complete credit purchase statistics and revenue analytics  

See [SYSTEM_AUDIT_FIXES.md](SYSTEM_AUDIT_FIXES.md) for complete audit report.

---

Built with ❤️ for modern ride-hailing
