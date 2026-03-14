import dotenv from 'dotenv';

dotenv.config();

type DbProvider = 'mysql' | 'postgres';

function detectProvider(): DbProvider {
    const explicit = String(process.env.DB_PROVIDER || '').trim().toLowerCase();
    if (explicit === 'mysql' || explicit === 'postgres') return explicit;

    const databaseUrl = String(process.env.DATABASE_URL || '').trim();
    if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) return 'postgres';
    if (databaseUrl.startsWith('mysql://')) return 'mysql';

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

    if (process.env.MYSQL_HOST || process.env.MYSQL_DATABASE || process.env.MYSQL_USER) return 'mysql';

    // Default: keep backward compatibility.
    return 'mysql';
}

async function main() {
    const provider = detectProvider();

    // Make the decision explicit for any downstream imports.
    process.env.DB_PROVIDER = provider;

    console.log(`[init-db] Using provider: ${provider}`);

    if (provider === 'postgres') {
        await import('./init-db-postgres.js');
        return;
    }

    await import('./init-db-mysql.js');
}

main().catch((e) => {
    console.error('[init-db] Failed:', e?.message || e);
    process.exit(1);
});

