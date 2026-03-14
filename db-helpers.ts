// Helper to convert PostgreSQL queries to SQLite
export function convertQuery(pgQuery: string): string {
    let sqliteQuery = pgQuery;
    
    // Replace $1, $2, etc. with ?
    sqliteQuery = sqliteQuery.replace(/\$\d+/g, '?');
    
    // Replace RETURNING * with nothing (handle separately)
    sqliteQuery = sqliteQuery.replace(/\s+RETURNING\s+\*/gi, '');
    
    // Replace gen_random_uuid() with custom function
    sqliteQuery = sqliteQuery.replace(/gen_random_uuid\(\)/gi, 'generateId()');
    
    // Replace CURRENT_TIMESTAMP with datetime('now')
    sqliteQuery = sqliteQuery.replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");
    
    // Replace NOW() with datetime('now')
    sqliteQuery = sqliteQuery.replace(/NOW\(\)/gi, "datetime('now')");
    
    // Replace DECIMAL with REAL
    sqliteQuery = sqliteQuery.replace(/DECIMAL\(\d+,\d+\)/gi, 'REAL');
    
    // Replace UUID with TEXT
    sqliteQuery = sqliteQuery.replace(/UUID/gi, 'TEXT');
    
    // Replace BOOLEAN with INTEGER
    sqliteQuery = sqliteQuery.replace(/BOOLEAN/gi, 'INTEGER');
    
    // Replace true/false with 1/0
    sqliteQuery = sqliteQuery.replace(/\btrue\b/gi, '1');
    sqliteQuery = sqliteQuery.replace(/\bfalse\b/gi, '0');
    
    // Replace JSONB with TEXT
    sqliteQuery = sqliteQuery.replace(/JSONB/gi, 'TEXT');
    
    return sqliteQuery;
}

// Helper for INSERT ... RETURNING
export function handleInsertReturning(query: string, params: any[], db: any, generateId: () => string): any {
    if (query.includes('RETURNING')) {
        const tableName = query.match(/INSERT INTO (\w+)/i)?.[1];
        const cleanQuery = query.replace(/RETURNING.*/i, '');
        const convertedQuery = convertQuery(cleanQuery);
        
        // Generate ID if needed
        const hasIdParam = query.toLowerCase().includes('(id,') || query.toLowerCase().includes('(id )');
        let finalParams = [...params];
        
        if (!hasIdParam && tableName) {
            const id = generateId();
            // Insert ID as first parameter
            const insertMatch = query.match(/INSERT INTO \w+ \((.*?)\)/i);
            if (insertMatch) {
                finalParams = [id, ...params];
            }
        }
        
        const stmt = db.prepare(convertedQuery);
        const info = stmt.run(...finalParams);
        
        // Get inserted row
        if (tableName) {
            const row = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(info.lastInsertRowid);
            return { rows: row ? [row] : [] };
        }
    }
    
    return null;
}
