# iTaxi Deployment Guide

This application is designed to scale using a stateless architecture and a MySQL or PostgreSQL database.

## Prerequisites

1.  **Node.js** (v18+)
2.  **Database**: MySQL (v8+) or PostgreSQL (v14+ recommended)
3.  **Redis** (Optional, recommended for Socket.IO scaling across multiple instances)

## Environment Variables

Create a `.env` file in the root directory with the following keys:

```env
# Choose DB provider: mysql|postgres
DB_PROVIDER=mysql

# MySQL Connection (when DB_PROVIDER=mysql)
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=itaxi

# PostgreSQL Connection (when DB_PROVIDER=postgres) (recommended)
# DATABASE_URL=postgresql://postgres:your_password@localhost:5432/itaxi

# Security
JWT_SECRET=your_secure_random_string_here

# Maps & Routing (Get keys from respective providers)
ORS_API_KEY=your_openrouteservice_key
MAPBOX_TOKEN=your_mapbox_token
GOOGLE_MAPS_KEY=your_google_maps_key

# Server Config
PORT=5000
NODE_ENV=production
```

## Database Setup

1.  Ensure your selected database is running and the credentials in `.env` have permissions to create/use the database.
2.  Run `npm run init-db` once to create tables and seed defaults.
    ```bash
    npm run init-db
    ```
    *Note: The init script is idempotent and safe to re-run.*

## Running in Production

1.  **Build the Frontend:**
    ```bash
    npm install
    npm run build
    ```

2.  **Start the Server:**
    ```bash
    npm start
    ```

## Scaling Strategy (1 Million Users)

*   **Database:** Use proper indexes, connection pooling, and (when needed) replication/read replicas. Keep driver-location updates efficient and write-optimized.
*   **Real-time:** Socket.IO is configured. For multiple server instances, use the **Redis Adapter** for Socket.IO to broadcast events across nodes.
*   **Caching:** Implement Redis caching for `admin_settings` and active driver locations if database load becomes too high.
*   **Load Balancing:** Deploy multiple instances of the Node.js server behind Nginx or a cloud load balancer.
