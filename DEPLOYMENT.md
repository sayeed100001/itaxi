# Vercel Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (sign up at vercel.com)
- MySQL database (PlanetScale, Railway, or any MySQL provider)

## Step 1: Push to GitHub

```bash
cd "d:\1111web apps\itaxi"
git init
git add .
git commit -m "Initial commit - iTaxi Enterprise with commission system"
git branch -M main
git remote add origin https://github.com/sayeed100001/itaxi.git
git push -u origin main
```

## Step 2: Setup Database

### Option A: PlanetScale (Recommended)
1. Go to https://planetscale.com
2. Create new database: `itaxi-production`
3. Get connection string
4. Run migrations:
```bash
cd server
DATABASE_URL="your_planetscale_url" npx prisma db push
```

### Option B: Railway
1. Go to https://railway.app
2. Create MySQL database
3. Get connection string
4. Run migrations

## Step 3: Deploy to Vercel

### Via Vercel Dashboard
1. Go to https://vercel.com/new
2. Import your GitHub repository: `sayeed100001/itaxi`
3. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build:prod`
   - **Output Directory**: `dist`

4. Add Environment Variables:
   ```
   NODE_ENV=production
   DATABASE_URL=your_mysql_connection_string
   JWT_SECRET=your_random_secret_key
   CLIENT_URL=https://your-app.vercel.app
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   OPENROUTESERVICE_API_KEY=your_key
   GEMINI_API_KEY=your_key
   ```

5. Click **Deploy**

### Via Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

## Step 4: Configure Stripe Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-app.vercel.app/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret to Vercel environment variables

## Step 5: Database Migrations

After first deployment:
```bash
cd server
DATABASE_URL="your_production_url" npx prisma db push
DATABASE_URL="your_production_url" npx prisma generate
```

## Step 6: Verify Deployment

1. Visit your Vercel URL
2. Test login with admin credentials
3. Check API endpoints: `https://your-app.vercel.app/api/health`
4. Test commission system

## Environment Variables Checklist

### Required
- ✅ `DATABASE_URL` - MySQL connection string
- ✅ `JWT_SECRET` - Random secret for JWT tokens
- ✅ `CLIENT_URL` - Your Vercel app URL
- ✅ `NODE_ENV` - Set to `production`

### Optional (for full features)
- ⚪ `STRIPE_SECRET_KEY` - For payments
- ⚪ `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- ⚪ `OPENROUTESERVICE_API_KEY` - For routing
- ⚪ `GEMINI_API_KEY` - For AI features
- ⚪ `WHATSAPP_API_KEY` - For WhatsApp messaging

## Troubleshooting

### Build Fails
- Check Node.js version (18+)
- Verify all dependencies installed
- Check build logs in Vercel dashboard

### Database Connection Fails
- Verify DATABASE_URL format
- Check database is accessible from Vercel
- Ensure SSL is enabled if required

### API Routes 404
- Verify vercel.json configuration
- Check server/src/index.ts exports correctly
- Ensure routes are registered

## Post-Deployment

1. **Setup Admin User**:
   - Login with: +93700000000 / admin123
   - Change password in settings

2. **Configure Credit Packages**:
   - Go to Admin → Finance
   - Create credit packages

3. **Test Commission System**:
   - Create test trip
   - Verify 20/80 split
   - Check driver earnings

## Monitoring

- **Vercel Analytics**: Built-in performance monitoring
- **Error Tracking**: Check Vercel logs
- **Database**: Monitor connection pool usage

## Scaling

- **Database**: Upgrade plan as needed
- **Vercel**: Pro plan for better performance
- **CDN**: Assets automatically cached

---

**Support**: Check logs in Vercel dashboard for any issues
**Documentation**: See README.md for full feature list
