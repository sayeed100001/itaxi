export type ParsedMysqlUrl = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

function stripWrappingQuotes(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length < 2) return trimmed;
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function readEnvRaw(name: string): string | undefined {
    const raw = process.env[name];
    if (raw === undefined) return undefined;
    return stripWrappingQuotes(String(raw));
}

export function isPostgresUrl(value: string): boolean {
    const v = value.trim().toLowerCase();
    return v.startsWith('postgres://') || v.startsWith('postgresql://');
}

export function isMysqlUrl(value: string): boolean {
    const v = value.trim().toLowerCase();
    return v.startsWith('mysql://') || v.startsWith('mariadb://');
}

export function getPostgresConnectionStringFromEnv(): string | undefined {
    const candidates = [
        readEnvRaw('DATABASE_URL'),
        readEnvRaw('POSTGRES_URL'),
        readEnvRaw('POSTGRES_PRISMA_URL'),
        readEnvRaw('POSTGRES_URL_NON_POOLING'),
        readEnvRaw('NEON_DATABASE_URL'),
        readEnvRaw('NEON_DATABASE_URL_NON_POOLING')
    ];

    for (const candidate of candidates) {
        const url = typeof candidate === 'string' ? candidate.trim() : '';
        if (!url) continue;
        if (isPostgresUrl(url)) return url;
    }

    return undefined;
}

export function getMysqlConnectionStringFromEnv(): string | undefined {
    const candidates = [
        readEnvRaw('DATABASE_URL'),
        readEnvRaw('MYSQL_URL'),
        readEnvRaw('MYSQL_PUBLIC_URL'),
        readEnvRaw('JAWSDB_URL'),
        readEnvRaw('CLEARDB_DATABASE_URL')
    ];

    for (const candidate of candidates) {
        const url = typeof candidate === 'string' ? candidate.trim() : '';
        if (!url) continue;
        if (isMysqlUrl(url)) return url;
    }

    return undefined;
}

export function parseMysqlUrl(url: string): ParsedMysqlUrl | null {
    try {
        const parsed = new URL(url);
        const protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol !== 'mysql:' && protocol !== 'mariadb:') return null;

        const host = parsed.hostname;
        const port = parsed.port ? Number.parseInt(parsed.port, 10) : 3306;
        const user = decodeURIComponent(parsed.username || 'root');
        const password = decodeURIComponent(parsed.password || '');
        const database = decodeURIComponent(String(parsed.pathname || '').replace(/^\//, '') || 'itaxi');

        if (!host) return null;

        return {
            host,
            port: Number.isFinite(port) && port > 0 ? port : 3306,
            user,
            password,
            database
        };
    } catch {
        return null;
    }
}

