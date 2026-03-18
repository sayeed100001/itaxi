# Database Migrations

## How to Run Migrations

### Recommended (all environments)
This project uses an **idempotent schema bootstrap** via `npm run init-db` which works for both **MySQL (local)** and **PostgreSQL (Neon/Vercel)**:

```bash
npm run init-db
```

Provider is auto-detected from env (or set explicitly with `DB_PROVIDER`). Common production envs (like Vercel Postgres/Neon) expose `POSTGRES_URL`, and local/dev often uses `MYSQL_*` or a `DATABASE_URL` starting with `mysql://`.

### MySQL (manual SQL)
```bash
mysql -u root -p itaxi < migrations/001_add_background_checks.sql
```

> Note: `migrations/001_add_background_checks.sql` is **MySQL-focused** (ENUM/DDL differences). For PostgreSQL use `npm run init-db:pg` (or `npm run init-db` with `DB_PROVIDER=postgres` + a Postgres URL).

## Migration 001: Background Checks & KYC System

This migration adds:

1. **background_checks table** - Stores KYC documents (national ID, driving license, criminal record)
2. **KYC fields in drivers table**:
   - kyc_status (unverified, pending, approved, rejected)
   - kyc_updated_at
   - background_check_status
   - background_check_date
   - driver_level (basic, standard, special, premium, vip)
   - taxi_type_id
   - service_types (JSON)
   - earnings
   - join_date

3. **taxi_types table** - Manages different taxi service levels (eco, plus, lux, premium)

4. **Driver Credit System**:
   - driver_credit_accounts - Driver operational credit balances
   - driver_credit_ledger - All credit transactions
   - system_revenue_ledger - Platform revenue tracking

5. **Admin System**:
   - admin_logs - Audit trail for admin actions
   - system_settings - System configuration

6. **User enhancements**:
   - status field (active, suspended, banned)
   - email field

## Verification

After running the migration, verify with:

```sql
-- Check if background_checks table exists
SHOW TABLES LIKE 'background_checks';

-- Check drivers table has KYC fields
DESCRIBE drivers;

-- Check taxi_types are seeded
SELECT * FROM taxi_types;
```

## Rollback

If you need to rollback this migration:

```sql
DROP TABLE IF EXISTS background_checks;
DROP TABLE IF EXISTS driver_credit_ledger;
DROP TABLE IF EXISTS driver_credit_accounts;
DROP TABLE IF EXISTS system_revenue_ledger;
DROP TABLE IF EXISTS admin_logs;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS taxi_types;

ALTER TABLE drivers 
DROP COLUMN IF EXISTS kyc_status,
DROP COLUMN IF EXISTS kyc_updated_at,
DROP COLUMN IF EXISTS background_check_status,
DROP COLUMN IF EXISTS background_check_date,
DROP COLUMN IF EXISTS driver_level,
DROP COLUMN IF EXISTS taxi_type_id,
DROP COLUMN IF EXISTS service_types,
DROP COLUMN IF EXISTS earnings,
DROP COLUMN IF EXISTS join_date;

ALTER TABLE users 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS email;

ALTER TABLE rides 
DROP COLUMN IF EXISTS taxi_type_id,
DROP COLUMN IF EXISTS notes;
```
