import { register } from 'tsx/esm/api';

// Enables importing/running TypeScript (.ts) directly in Node.js (ESM).
// Required for shared hosting setups (e.g., cPanel "Setup Node.js App") where the startup file must be .js.
register();

// Initialize DB schema/seed (idempotent) then start the API + static server.
await import('./init-db-auto.ts');
await import('./server.ts');
