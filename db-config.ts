import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';

dotenv.config();

interface QueryResult {
    rows: any[];
    insertId?: number;
}

type DbProvider = 'mysql' | 'postgres';

class DatabaseAdapter {
    public readonly provider: DbProvider;
    private mysqlPool: mysql.Pool | null = null;
    private pgPool: PgPool | null = null;

    constructor() {
        this.provider = this.detectProvider();
        this.initialize();
    }

    private detectProvider(): DbProvider {
        const explicit = String(process.env.DB_PROVIDER || '').trim().toLowerCase();
        if (explicit === 'mysql' || explicit === 'postgres') return explicit;

        const databaseUrl = String(process.env.DATABASE_URL || '').trim();
        if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) return 'postgres';
        if (databaseUrl.startsWith('mysql://')) return 'mysql';

        // Prefer Postgres if any PG env hints are present.
        if (
            process.env.POSTGRES_HOST ||
            process.env.POSTGRES_DATABASE ||
            process.env.POSTGRES_USER ||
            process.env.PGHOST ||
            process.env.PGDATABASE ||
            process.env.PGUSER
        ) {
            return 'postgres';
        }

        // Fallback to MySQL if configured.
        if (process.env.MYSQL_HOST || process.env.MYSQL_DATABASE || process.env.MYSQL_USER) return 'mysql';

        // Default: MySQL (most existing deployments).
        return 'mysql';
    }

    private initialize() {
        const connectionLimit =
            Number.parseInt(process.env.MYSQL_POOL_LIMIT || '', 10) ||
            Number.parseInt(process.env.DB_POOL_LIMIT || '', 10) ||
            20;
        const queueLimit =
            Number.parseInt(process.env.MYSQL_POOL_QUEUE_LIMIT || '', 10) ||
            Number.parseInt(process.env.DB_POOL_QUEUE_LIMIT || '', 10) ||
            0;

        if (this.provider === 'postgres') {
            const databaseUrl = String(process.env.DATABASE_URL || '').trim();
            this.pgPool = new PgPool(
                databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
                    ? {
                          connectionString: databaseUrl,
                          max: connectionLimit
                      }
                    : {
                          host: process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost',
                          port:
                              Number.parseInt(process.env.POSTGRES_PORT || process.env.PGPORT || '5432', 10) || 5432,
                          user: process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
                          password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '',
                          database: process.env.POSTGRES_DATABASE || process.env.PGDATABASE || 'itaxi',
                          max: connectionLimit
                      }
            );
            console.log('PostgreSQL Pool initialized');
            return;
        }

        this.mysqlPool = mysql.createPool({
            host: process.env.MYSQL_HOST || process.env.MYSQLHOST || 'localhost',
            port: Number.parseInt(process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306', 10) || 3306,
            user: process.env.MYSQL_USER || process.env.MYSQLUSER || 'root',
            password: process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || '',
            database: process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || 'itaxi',
            waitForConnections: true,
            connectionLimit,
            queueLimit
        });
        console.log('MySQL Pool initialized');
    }

    private mysqlNormalizeSql(text: string): string {
        let sql = text.replace(/\$(\d+)/g, '?');

        // Normalize PostgreSQL INTERVAL 'X unit' -> MySQL DATE_SUB
        sql = sql.replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+minutes?'/gi, "DATE_SUB(NOW(), INTERVAL $1 MINUTE)");
        sql = sql.replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+hours?'/gi, "DATE_SUB(NOW(), INTERVAL $1 HOUR)");
        sql = sql.replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+days?'/gi, "DATE_SUB(NOW(), INTERVAL $1 DAY)");
        sql = sql.replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+months?'/gi, "DATE_SUB(NOW(), INTERVAL $1 MONTH)");
        sql = sql.replace(/NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+years?'/gi, "DATE_SUB(NOW(), INTERVAL $1 YEAR)");

        // SQLite datetime modifiers -> MySQL equivalents.
        sql = sql.replace(/datetime\('now'\s*,\s*'start of day'\)/gi, "DATE_FORMAT(NOW(), '%Y-%m-%d 00:00:00')");
        sql = sql.replace(/datetime\('now'\s*,\s*'start of month'\)/gi, "DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')");
        sql = sql.replace(/datetime\('now'\s*,\s*'start of year'\)/gi, "DATE_FORMAT(NOW(), '%Y-01-01 00:00:00')");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*minutes?'\)/gi, "DATE_SUB(NOW(), INTERVAL $1 MINUTE)");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*hours?'\)/gi, "DATE_SUB(NOW(), INTERVAL $1 HOUR)");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*days?'\)/gi, "DATE_SUB(NOW(), INTERVAL $1 DAY)");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*months?'\)/gi, "DATE_SUB(NOW(), INTERVAL $1 MONTH)");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*years?'\)/gi, "DATE_SUB(NOW(), INTERVAL $1 YEAR)");
        sql = sql.replace(/datetime\('now'\)/gi, 'NOW()');

        sql = sql
            .replace(/CURRENT_TIMESTAMP/gi, 'NOW()')
            .replace(/strftime\('%H:00', created_at\)/gi, 'DATE_FORMAT(created_at, \"%H:00\")')
            .replace(/strftime\('%H', created_at\)/gi, 'HOUR(created_at)')
            .replace(/RETURNING \*/gi, '');

        return sql;
    }

    private static replaceQuestionMarkPlaceholders(text: string): string {
        let i = 0;
        let paramIndex = 1;
        let out = '';

        let inSingle = false;
        let inDouble = false;
        let inLineComment = false;
        let inBlockComment = false;

        while (i < text.length) {
            const ch = text[i];
            const next = i + 1 < text.length ? text[i + 1] : '';

            if (inLineComment) {
                out += ch;
                if (ch === '\n') inLineComment = false;
                i += 1;
                continue;
            }

            if (inBlockComment) {
                out += ch;
                if (ch === '*' && next === '/') {
                    out += next;
                    i += 2;
                    inBlockComment = false;
                    continue;
                }
                i += 1;
                continue;
            }

            if (!inSingle && !inDouble) {
                if (ch === '-' && next === '-') {
                    out += ch + next;
                    i += 2;
                    inLineComment = true;
                    continue;
                }
                if (ch === '/' && next === '*') {
                    out += ch + next;
                    i += 2;
                    inBlockComment = true;
                    continue;
                }
            }

            if (ch === "'" && !inDouble) {
                out += ch;
                if (inSingle && next === "'") {
                    // Escaped quote inside string literal.
                    out += next;
                    i += 2;
                    continue;
                }
                inSingle = !inSingle;
                i += 1;
                continue;
            }

            if (ch === '"' && !inSingle) {
                out += ch;
                inDouble = !inDouble;
                i += 1;
                continue;
            }

            if (ch === '?' && !inSingle && !inDouble) {
                out += `$${paramIndex++}`;
                i += 1;
                continue;
            }

            out += ch;
            i += 1;
        }

        return out;
    }

    private postgresNormalizeSql(text: string): string {
        let sql = text;

        // Normalize SQLite datetime modifiers -> Postgres equivalents.
        sql = sql.replace(/datetime\('now'\s*,\s*'start of day'\)/gi, "date_trunc('day', NOW())");
        sql = sql.replace(/datetime\('now'\s*,\s*'start of month'\)/gi, "date_trunc('month', NOW())");
        sql = sql.replace(/datetime\('now'\s*,\s*'start of year'\)/gi, "date_trunc('year', NOW())");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*minutes?'\)/gi, "NOW() - INTERVAL '$1 minutes'");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*hours?'\)/gi, "NOW() - INTERVAL '$1 hours'");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*days?'\)/gi, "NOW() - INTERVAL '$1 days'");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*months?'\)/gi, "NOW() - INTERVAL '$1 months'");
        sql = sql.replace(/datetime\('now'\s*,\s*'-(\d+)\s*years?'\)/gi, "NOW() - INTERVAL '$1 years'");
        sql = sql.replace(/datetime\('now'\)/gi, 'NOW()');

        // Normalize MySQL date arithmetic -> Postgres.
        sql = sql.replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+MINUTE\s*\)/gi, "NOW() - INTERVAL '$1 minutes'");
        sql = sql.replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+HOUR\s*\)/gi, "NOW() - INTERVAL '$1 hours'");
        sql = sql.replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "NOW() - INTERVAL '$1 days'");
        sql = sql.replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+MONTH\s*\)/gi, "NOW() - INTERVAL '$1 months'");
        sql = sql.replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+YEAR\s*\)/gi, "NOW() - INTERVAL '$1 years'");
        // Normalize bare MySQL INTERVAL X UNIT (without DATE_SUB) -> Postgres
        sql = sql.replace(/INTERVAL\s+(\d+)\s+MINUTE\b/gi, "INTERVAL '$1 minutes'");
        sql = sql.replace(/INTERVAL\s+(\d+)\s+HOUR\b/gi, "INTERVAL '$1 hours'");
        sql = sql.replace(/INTERVAL\s+(\d+)\s+DAY\b/gi, "INTERVAL '$1 days'");
        sql = sql.replace(/INTERVAL\s+(\d+)\s+MONTH\b/gi, "INTERVAL '$1 months'");
        sql = sql.replace(/INTERVAL\s+(\d+)\s+YEAR\b/gi, "INTERVAL '$1 years'");

        // Normalize MySQL date formatting -> Postgres.
        sql = sql.replace(/DATE_FORMAT\s*\(\s*([^,]+?)\s*,\s*'%H:00'\s*\)/gi, "to_char($1, 'HH24:00')");
        sql = sql.replace(/DATE_FORMAT\s*\(\s*([^,]+?)\s*,\s*'%Y-%m-%d'\s*\)/gi, "to_char($1, 'YYYY-MM-DD')");

        // MySQL hour/day helpers.
        sql = sql.replace(/\bHOUR\s*\(\s*([^)]+?)\s*\)/gi, 'EXTRACT(HOUR FROM $1)');
        sql = sql.replace(/\bDAYOFWEEK\s*\(\s*([^)]+?)\s*\)/gi, '(EXTRACT(DOW FROM $1) + 1)');

        // SQLite strftime shims (rare, but kept for compatibility).
        sql = sql.replace(/strftime\('%H:00'\s*,\s*([^)]+?)\)/gi, "to_char($1, 'HH24:00')");
        sql = sql.replace(/strftime\('%H'\s*,\s*([^)]+?)\)/gi, 'EXTRACT(HOUR FROM $1)');

        // MySQL JSON_CONTAINS(JSON, JSON_QUOTE(?)) -> jsonb_exists(.., ?)
        sql = sql.replace(
            /JSON_CONTAINS\s*\(\s*([^,]+?)\s*,\s*JSON_QUOTE\s*\(\s*(\?|\$\d+)\s*\)\s*\)/gi,
            'jsonb_exists(($1)::jsonb, $2)'
        );

        // MySQL INSERT IGNORE -> Postgres ON CONFLICT DO NOTHING
        if (/^\s*INSERT\s+IGNORE\s+/i.test(sql)) {
            sql = sql.replace(/INSERT\s+IGNORE\s+/i, 'INSERT ');
            if (!/ON\s+CONFLICT/i.test(sql)) {
                const hadSemicolon = /;\s*$/.test(sql);
                sql = sql.replace(/;\s*$/, '');
                sql = `${sql} ON CONFLICT DO NOTHING${hadSemicolon ? ';' : ''}`;
            }
        }

        // Convert MySQL boolean-style comparisons (1/0) to Postgres booleans for known columns.
        sql = sql.replace(/\b((?:\w+\.)?(?:is_active|active|is_read|recording_enabled))\s*=\s*1\b/gi, '$1 = TRUE');
        sql = sql.replace(/\b((?:\w+\.)?(?:is_active|active|is_read|recording_enabled))\s*=\s*0\b/gi, '$1 = FALSE');

        // Use NOW() everywhere for consistency.
        sql = sql.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');

        // Finally, convert ? placeholders to $1..$n
        sql = DatabaseAdapter.replaceQuestionMarkPlaceholders(sql);

        return sql;
    }

    async query(text: string, params: any[] = []): Promise<QueryResult> {
        if (this.provider === 'postgres') {
            if (!this.pgPool) throw new Error('PostgreSQL pool not initialized');
            const pgQuery = this.postgresNormalizeSql(text);
            try {
                const res = await this.pgPool.query(pgQuery, params);
                const cmd = String((res as any).command || '').toUpperCase();

                if (cmd === 'SELECT') {
                    return { rows: res.rows };
                }

                if (cmd === 'INSERT') {
                    // Most inserts use explicit IDs. Keep compatibility with existing callers.
                    return { rows: res.rows || [] };
                }

                // UPDATE/DELETE/DDL: emulate mysql2 shape for affected rows.
                return { rows: [{ affectedRows: res.rowCount ?? 0 }] };
            } catch (error: any) {
                console.error('Database query error:', {
                    provider: 'postgres',
                    query: pgQuery,
                    params,
                    error: error?.message || String(error)
                });
                throw error;
            }
        }

        if (!this.mysqlPool) throw new Error('MySQL pool not initialized');

        const mysqlQuery = this.mysqlNormalizeSql(text);

        try {
            const [rows]: any = await this.mysqlPool.execute(mysqlQuery, params);

            if (text.toUpperCase().includes('INSERT')) {
                return { rows: [], insertId: rows.insertId };
            }

            return { rows: Array.isArray(rows) ? rows : [rows] };
        } catch (error: any) {
            console.error('Database query error:', {
                provider: 'mysql',
                query: mysqlQuery,
                params,
                error: error.message
            });
            throw error;
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.query('SELECT 1 as test');
            console.log('Database connection test successful');
            return true;
        } catch (error) {
            console.error('Database connection test failed:', error);
            return false;
        }
    }

    async close() {
        if (this.mysqlPool) {
            await this.mysqlPool.end();
            console.log('Database connection closed');
        }
        if (this.pgPool) {
            await this.pgPool.end();
            console.log('Database connection closed');
        }
    }
}

export const db = new DatabaseAdapter();
export const query = (text: string, params: any[] = []) => db.query(text, params);
