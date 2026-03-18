#!/bin/bash

# 🚀 iTaxi - Push to GitHub & Deploy to Vercel

echo "📦 Preparing to push fixes to GitHub..."

# 1. Add all changes
git add .

# 2. Commit with descriptive message
git commit -m "🔧 Fix: Resolve API URL corruption and Vercel deployment issues

- Fixed /api/api double path in API_BASE_URL
- Added ensureApiPath() function to prevent URL malformation
- Created .env.local for local development
- Created .env.production for Vercel deployment
- Updated vercel.json to proxy API to Railway backend
- Fixed services/api.ts URL cleaning logic
- Disabled Socket.IO on Vercel (serverless)
- Added Vercel deployment detection

Fixes:
- ✅ Vercel 405 Method Not Allowed error
- ✅ Local connection refused errors
- ✅ URL corruption with %22 characters
- ✅ Socket.IO on serverless platform"

# 3. Push to GitHub
echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Push complete!"
echo ""
echo "📊 Vercel will automatically deploy..."
echo "🔗 Check: https://vercel.com/sayeeds-projects-ba9cdca4/v0-i-taxi-platform"
echo ""
echo "⏱️  Deployment should complete in 2-3 minutes"
