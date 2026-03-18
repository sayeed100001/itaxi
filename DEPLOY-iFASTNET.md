# Deploy to iFastNet (cPanel "Setup Node.js App")

This project can run on iFastNet Premium Shared Hosting **without Docker**.

## 1) Pick a database

On iFastNet, **MySQL** is usually the simplest option.

Set one of these:

- **MySQL (recommended)**:
  - `DB_PROVIDER=mysql`
  - `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- **Postgres** (only if your plan provides it):
  - `DB_PROVIDER=postgres`
  - `POSTGRES_URL` (or `DATABASE_URL` as a postgres URL)

## 2) Upload the project

Option A (recommended): upload as a zip via File Manager and extract.
Option B: `git clone` (only if you can run the build step on the server).

## 3) Install dependencies

Run `npm install` in your project root on the server.

Important: `npm run build` requires **Vite** (devDependency). If your hosting installs only production deps, build locally and upload `dist/`.

## 4) Build frontend (creates `dist/`)

- On the server (if dev deps are installed): `npm run build`
- Or locally on your PC: `npm install` then `npm run build` and upload the generated `dist/` folder.

## 5) Create `.env` on the server

Copy `.env.example` to `.env` and set at least:

- `NODE_ENV=production`
- `JWT_SECRET=<very-long-random-secret>`
- Your database settings (see section 1)

## 6) Create the Node.js App in cPanel

In **cPanel → Setup Node.js App**:

- Node version: pick the latest available (prefer **Node 20.x**)
- Application root: your project folder
- Application startup file: `app.js`
- Add environment variables (same as your `.env`, or just keep `.env` and don’t duplicate)

Restart the app.

## 7) Smoke test

Open in browser:

- `https://YOUR_DOMAIN/api/health`
- `https://YOUR_DOMAIN/api/ready`

Then try login:

- Admin demo: `+10000000000 / admin123`

## Notes (real production)

- Socket.IO/WebSockets may be limited on shared hosting; for full realtime reliability use a VPS.
- Uploads/KYC documents are stored on local disk; for serious production use object storage (S3/R2/etc).

