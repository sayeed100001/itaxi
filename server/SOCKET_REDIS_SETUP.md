# Socket.IO Redis Adapter - Multi-Instance Setup

## Overview
Socket.IO now uses a getter pattern (`getIo()`) instead of global assignment, with optional Redis adapter for horizontal scaling.

## Changes Made

### 1. **socket.ts** - Exportable Getter
```typescript
let io: SocketServer | null = null;

export function getIo(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
}
```

### 2. **index.ts** - Removed Global Assignment
```typescript
// Before:
const io = initializeSocket(httpServer);
(global as any).io = io;

// After:
initializeSocket(httpServer);
```

### 3. **Controllers** - Import getIo()
```typescript
// Before:
const io = (global as any).io;

// After:
import { getIo } from '../config/socket';
const io = getIo();
```

## Redis Adapter Setup

### Environment Variables
```bash
# Required for multi-instance
REDIS_URL=redis://localhost:6379

# Set to true when using PM2 cluster mode
PM2_CLUSTER=true
```

### Automatic Initialization
Redis adapter is automatically enabled if `REDIS_URL` is set:

```typescript
if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('Socket.IO Redis adapter enabled');
}
```

### PM2 Cluster Warning
If `PM2_CLUSTER=true` but `REDIS_URL` is not set, a warning is logged:
```
WARNING: PM2_CLUSTER=true but REDIS_URL not set. Multi-instance Socket.IO will not work correctly.
```

## Files Modified

1. **server/src/config/socket.ts**
   - Added `getIo()` getter function
   - Added safe initialization check
   - Added PM2 cluster warning
   - Replaced all `io` references with `io!`

2. **server/src/index.ts**
   - Removed `(global as any).io = io`
   - Changed to `initializeSocket(httpServer)`

3. **server/src/controllers/trip.controller.ts**
   - Replaced `(global as any).io` with `getIo()`

4. **server/.env.example**
   - Added `REDIS_URL` configuration
   - Added `PM2_CLUSTER` flag

## Usage Examples

### Single Instance (No Redis)
```bash
# .env
REDIS_URL=
PM2_CLUSTER=false
```

### Multi-Instance with Redis
```bash
# .env
REDIS_URL=redis://localhost:6379
PM2_CLUSTER=true

# Start with PM2
pm2 start ecosystem.config.js
```

### In Code
```typescript
import { getIo } from './config/socket';

// In any service or controller
const io = getIo();
io.to('room').emit('event', data);
```

## Testing

### Unit Tests
```bash
npm test -- socket.test.ts
```

Tests cover:
- ✅ Error when `getIo()` called before initialization
- ✅ Returns valid io instance after initialization
- ✅ Returns same instance on multiple calls
- ✅ Safe reinitialization (returns existing instance)
- ✅ Warning when PM2_CLUSTER=true without REDIS_URL

## Production Deployment

### With Redis (Recommended)
```bash
# Install Redis
docker run -d -p 6379:6379 redis:alpine

# Configure environment
REDIS_URL=redis://localhost:6379
PM2_CLUSTER=true

# Deploy with PM2
pm2 start ecosystem.config.js -i max
```

### Without Redis (Single Instance)
```bash
# Configure environment
PM2_CLUSTER=false

# Deploy
pm2 start ecosystem.config.js -i 1
```

## Benefits

1. **No Global Pollution**: Removed `(global as any).io`
2. **Type Safety**: Proper TypeScript types with getter
3. **Error Handling**: Throws clear error if not initialized
4. **Horizontal Scaling**: Redis adapter for multi-instance
5. **Safe Initialization**: Prevents double initialization
6. **Validation**: Warns about misconfiguration

## Troubleshooting

### Error: "Socket.IO not initialized"
- Ensure `initializeSocket()` is called before using `getIo()`
- Check server startup logs

### Redis Connection Failed
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL format: `redis://host:port`
- Falls back to in-memory adapter automatically

### PM2 Cluster Not Working
- Ensure REDIS_URL is set
- Check PM2_CLUSTER=true
- Verify Redis adapter logs: "Socket.IO Redis adapter enabled"

## Migration Checklist

- [x] Remove global io assignment
- [x] Add getIo() getter function
- [x] Update all global.io references
- [x] Add Redis adapter initialization
- [x] Add PM2 cluster warning
- [x] Update environment variables
- [x] Add unit tests
- [x] Update documentation
