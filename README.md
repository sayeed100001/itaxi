# iTaxi - Enterprise Ride-Hailing Platform

iTaxi is a production-ready, enterprise-grade ride-hailing platform built with a modern tech stack.

## Tech Stack

- **Frontend:** React 18+, Tailwind CSS, Zustand, Lucide React
- **Backend:** Node.js, Express.js, Socket.IO, MySQL or PostgreSQL
- **Security:** JWT Authentication, bcrypt, helmet, express-rate-limit
- **Infrastructure:** Redis, Stripe, Twilio, Firebase Admin

## Installation

1. Clone the repository.
2. Install dependencies: `npm install`
3. Configure environment variables:
   - Copy `.env.example` to `.env`.
   - Choose DB provider: `DB_PROVIDER=mysql` (default) or `DB_PROVIDER=postgres`.
   - For MySQL: set `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` **or** set `DATABASE_URL=mysql://user:pass@host:3306/db`.
   - For Postgres (Neon/Vercel Postgres): set `DATABASE_URL=postgresql://...` **or** rely on `POSTGRES_URL` (provided by the integration).
   - Set `JWT_SECRET`.
4. Initialize schema + seed defaults: `npm run init-db`
5. Run the development server (no Docker required): `npm run dev`

## Deployment

- The application is configured for deployment on platforms supporting Node.js and MySQL or PostgreSQL.
- Ensure all environment variables are set in your production environment.
- Use `npm run build` to build the frontend.
- Run `npm run init-db` once, then use `npm run server` (or a process manager like PM2) to run the server in production.

### Vercel (Frontend)
- `vercel.json` rewrites `/api/*` and `/uploads/*` to the backend service.
- `VITE_API_URL` is optional (if omitted, the frontend defaults to same-origin `/api`).
- If you set `VITE_API_URL`, you can use either `https://backend.example.com` **or** `https://backend.example.com/api` (both work).

## Future Improvements

- Implement full real-time driver tracking with H3 geospatial indexing.
- Integrate Stripe for payments.
- Integrate Twilio for SMS notifications.
- Integrate Firebase for push notifications.
