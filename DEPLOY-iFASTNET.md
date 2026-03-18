# iTaxi Deployment Guide for iFastNet

This guide explains how to host this project on `https://ifastnet.com/` without Docker.

It is written for this repository as it exists now:

- Frontend: React + Vite
- Backend: Express + Socket.IO
- Startup file for hosting: `server-entry.js`
- Recommended database on iFastNet: MySQL
- Recommended package flow: build locally, upload a clean zip, install dependencies on the server

## 1. What you need

Before you start, make sure you have:

- an iFastNet plan that includes `cPanel` and `Node.js`
- access to `cPanel`
- a domain or subdomain already attached to the hosting account
- a MySQL database on the same hosting account
- local access to this repository on your PC

This guide assumes you will host the full app on iFastNet and use MySQL there.

## 2. How this project should run on iFastNet

This project does not need Docker.

On iFastNet, the app should run like this:

1. Vite builds the frontend into `dist/`
2. `server.ts` serves the API and also serves the built frontend from `dist/`
3. `server-entry.js` starts TypeScript runtime support, runs database initialization, and then starts the server
4. MySQL is used as the production database

That means your iFastNet deployment needs:

- source files
- `dist/`
- `package.json`
- `.env`
- `node_modules` installed on the server

## 3. Recommended deployment method

Use this method:

1. Build and package the app on your PC
2. Upload the generated zip to iFastNet File Manager
3. Extract it into the application folder
4. Create the MySQL database and user in cPanel
5. Create the Node.js app in cPanel
6. Add environment variables
7. Install dependencies on the server
8. Restart the Node.js app

## 4. Build a clean deployment zip on your PC

From the project root, run:

```powershell
npm install
npm run lint
npm run zip:build
```

This creates:

```text
release/itaxi.zip
```

Use that zip for iFastNet.

Why this is the best option:

- it includes the built frontend
- it excludes local junk and temporary files
- it excludes `.env`
- it keeps the package smaller and cleaner

## 5. Create the MySQL database in cPanel

Inside iFastNet cPanel:

1. Open `MySQL Databases`
2. Create a new database
3. Create a new database user
4. Add the user to the database
5. Grant `ALL PRIVILEGES`

Important notes:

- iFastNet usually prefixes database names and usernames with your cPanel account name
- for example, if your cPanel username is `abc123`, the final database name may look like `abc123_itaxi`
- the MySQL host is often `localhost`, but you must use the exact value shown by your hosting account if iFastNet gives you a different host
- the MySQL port is usually `3306`

Keep these values:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

## 6. Upload the project

Recommended application folder:

```text
/home/YOUR_CPANEL_USER/itaxi
```

This is usually better than placing the whole Node.js project inside `public_html`.

Upload `release/itaxi.zip` with cPanel File Manager:

1. Open `File Manager`
2. Go to the folder where you want the app to live
3. Upload `itaxi.zip`
4. Extract it
5. Confirm that the extracted folder contains files like:

```text
server-entry.js
server.ts
package.json
dist/
api/
services/
pages/
components/
```

## 7. Create the `.env` file

Copy `.env.example` to `.env` inside the application root.

Use MySQL on iFastNet unless you intentionally want to connect to an external PostgreSQL service.

Minimal production example:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=replace_this_with_a_long_random_secret

DB_PROVIDER=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=YOUR_CPANEL_DB_USER
MYSQL_PASSWORD=YOUR_DATABASE_PASSWORD
MYSQL_DATABASE=YOUR_CPANEL_DB_NAME
```

Optional variables can be added later:

- `REDIS_URL`
- `STRIPE_SECRET_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `ORS_API_KEY`
- `MAPBOX_ACCESS_TOKEN`

If you do not need those services yet, leave them unset.

## 8. Create the Node.js app in cPanel

In cPanel, open:

```text
Setup Node.js App
```

Use these values:

- Node.js version: latest available, preferably `20.x`
- Application mode: `Production`
- Application root: your extracted project folder, for example `itaxi`
- Application URL: your domain or subdomain
- Application startup file: `server-entry.js`

After creating the app:

1. open the app details page
2. add your environment variables there if you prefer cPanel-managed env values
3. save the app

If you already created `.env`, keep the values consistent. Do not mix conflicting values between `.env` and the cPanel UI.

## 9. Install dependencies on the server

You need `node_modules` on the server.

Use one of these:

### Option A: cPanel Terminal or SSH

Open Terminal or SSH, then run:

```bash
cd ~/itaxi
npm install
```

### Option B: Node.js App package installer

Some cPanel Node.js setups expose an install action on the app page.

If your iFastNet panel shows an install button for Node packages, run it from the application root.

If your panel exposes neither Terminal nor a package install action, open an iFastNet support ticket and ask them to confirm the correct Node.js workflow for your plan. Do not upload a Windows `node_modules` folder.

## 10. Start the app

Restart the Node.js app from cPanel after:

- creating the app
- saving environment variables
- running `npm install`
- updating code

This project uses:

```text
server-entry.js
```

That startup file will:

1. enable TypeScript execution
2. run database initialization
3. start the API server

## 11. Frontend build behavior

If you uploaded the zip created by:

```powershell
npm run zip:build
```

then `dist/` is already included and you do not need to build again on the server.

If you uploaded raw source instead of the zip, then you must run:

```bash
npm install
npm run build
```

before restarting the app.

## 12. Uploads and KYC files

This project stores uploaded files locally on disk in:

```text
public/uploads
```

For iFastNet shared hosting:

- make sure the application user can write to that folder
- create the folder manually if needed
- remember that shared-hosting local storage is not ideal for high-scale production

For serious production, move uploads to object storage such as S3 or Cloudflare R2.

## 13. Smoke test after deployment

After the app starts, test these URLs in the browser:

```text
https://YOUR_DOMAIN/api/health
https://YOUR_DOMAIN/api/ready
```

Then test the UI:

```text
https://YOUR_DOMAIN/
```

Then test login with the seeded demo admin:

- phone: `+10000000000`
- password: `admin123`

## 14. Common problems and fixes

### Problem: blank page or 404 on the main site

Check:

- `dist/` exists in the application root
- the Node.js app is running
- the application URL in cPanel points to the correct domain or subdomain

### Problem: app starts but database does not work

Check:

- `DB_PROVIDER=mysql`
- database name and username include the full cPanel prefix
- MySQL host is correct
- database user has privileges on the database

### Problem: server crashes on startup

Check:

- startup file is exactly `server-entry.js`
- `npm install` was actually run in the app root
- Node.js version is modern enough
- `.env` does not contain broken values

### Problem: frontend loads but API calls fail

Check:

- the Node.js app is running
- `/api/health` responds
- domain is routed to the Node.js app, not to an old static `public_html` site

### Problem: uploads or KYC files do not save

Check:

- `public/uploads` exists
- write permissions are correct
- the app process user can write to that folder

### Problem: Socket.IO is unstable

This can happen on shared hosting.

The app may still work, but real-time features can be less reliable than on a VPS.

## 15. Recommended production settings

Use these rules:

- use MySQL on iFastNet
- use a long random `JWT_SECRET`
- keep `NODE_ENV=production`
- use HTTPS only
- do not store secrets in Git
- keep `.env` private
- restart the Node.js app after every deployment

## 16. Fast deployment checklist

Use this checklist every time:

1. Run `npm run zip:build` on your PC
2. Upload `release/itaxi.zip`
3. Extract it into the app root
4. Verify `.env`
5. Verify MySQL credentials
6. Confirm startup file is `server-entry.js`
7. Run `npm install` on the server
8. Restart the Node.js app
9. Test `/api/health`
10. Test login and the main dashboard

## 17. Official iFastNet references

I checked these iFastNet public pages on March 18, 2026:

- Premium Shared Hosting features: `https://ifastnet.com/premium-hosting.php`
- Node.js knowledge base category: `https://kb.ifastnet.com/index.php?/News/NewsItem/View/180`
- File Manager article: `https://kb.ifastnet.com/index.php?%2Farticle%2FAA-00300%2F0%2FFile-Manager-Uploading-or-Removing-Files-and-Setting-File-or-Directory-Permissions.html=`
- MySQL / Remote MySQL article: `https://kb.ifastnet.com/index.php?%2Farticle%2FAA-00322%2F0%2FHow-to-setup-remote-mysql-access.html=`

If iFastNet changes the UI later, the exact button labels can move, but the deployment logic for this project should stay the same:

- upload the app
- set MySQL env values
- create the Node.js app
- use `server-entry.js`
- install dependencies
- restart
