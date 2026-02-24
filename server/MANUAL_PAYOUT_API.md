# Manual Payout Workflow - API Examples

## Overview
All payouts require manual admin approval. No automatic completion occurs.

## Environment Variables
```bash
DISABLE_PAYOUTS=false          # Set to true to completely disable payouts
ALLOW_AUTO_PAYOUTS=false       # Must be false (default) - only manual processing
STRIPE_TEST_MODE=true          # Use Stripe test mode
STRIPE_SECRET_KEY=sk_test_...  # Stripe secret key
```

## API Endpoints

### 1. List Pending Payouts
Get all payouts awaiting manual review.

```bash
curl -X GET http://localhost:5001/api/admin/payouts/pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payout_123",
      "driverId": "driver_456",
      "amount": 150.50,
      "status": "PENDING_MANUAL_REVIEW",
      "stripeTransferId": null,
      "idempotencyKey": null,
      "failureReason": null,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "driver": {
        "id": "driver_456",
        "stripeAccountId": "acct_1234567890",
        "user": {
          "name": "John Driver",
          "phone": "1234567890",
          "email": "john@example.com"
        }
      }
    }
  ]
}
```

### 2. Process Payout Manually
Admin manually approves and processes a payout.

```bash
curl -X POST http://localhost:5001/api/admin/payouts/process \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payoutId": "payout_123"
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Payout processed successfully",
  "data": {
    "id": "payout_123",
    "driverId": "driver_456",
    "amount": 150.50,
    "status": "COMPLETED",
    "stripeTransferId": "tr_1234567890",
    "idempotencyKey": "payout_123",
    "failureReason": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

**Response (Error - No Stripe Account):**
```json
{
  "success": false,
  "message": "Driver does not have Stripe account connected"
}
```

**Response (Error - Already Processed):**
```json
{
  "success": false,
  "message": "Payout already completed"
}
```

## Workflow States

1. **PENDING** → Initial state (legacy, auto-converted to PENDING_MANUAL_REVIEW)
2. **PENDING_MANUAL_REVIEW** → Awaiting admin approval (default for new payouts)
3. **PROCESSING** → Admin initiated processing
4. **COMPLETED** → Successfully transferred to driver
5. **FAILED** → Transfer failed (see failureReason)

## Security Features

### 1. Idempotency
- Each payout uses its ID as idempotency key
- Prevents duplicate processing
- Stripe transfers use same key

### 2. Admin-Only Access
- Requires admin JWT token
- All actions logged in AuditLog table

### 3. Validation Checks
- Driver must have Stripe account connected
- Payout must be in correct status
- Amount validation

### 4. Alert System
If `processPayout()` is called with `DISABLE_PAYOUTS=true`:
```
ERROR: ALERT: Auto payout attempted while DISABLE_PAYOUTS=true
```

## Testing Scenarios

### Test 1: Manual Approval Flow
```bash
# 1. Driver requests payout
curl -X POST http://localhost:5001/api/payouts/request \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -d '{"amount": 100}'

# 2. Admin lists pending
curl -X GET http://localhost:5001/api/admin/payouts/pending \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Admin processes
curl -X POST http://localhost:5001/api/admin/payouts/process \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"payoutId": "payout_123"}'
```

### Test 2: Idempotency
```bash
# Process same payout twice - second call returns existing result
curl -X POST http://localhost:5001/api/admin/payouts/process \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"payoutId": "payout_123"}'

# Response: "Payout already completed"
```

### Test 3: Disabled Payouts
```bash
# Set DISABLE_PAYOUTS=true in .env
# Attempt to process
curl -X POST http://localhost:5001/api/admin/payouts/process \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"payoutId": "payout_123"}'

# Response: "Automatic payouts are disabled"
# Server logs: "ALERT: Auto payout attempted while DISABLE_PAYOUTS=true"
```

## Database Queries

### Check Pending Payouts
```sql
SELECT p.id, p.amount, p.status, p.createdAt,
       d.stripeAccountId, u.name as driverName
FROM Payout p
JOIN Driver d ON p.driverId = d.id
JOIN User u ON d.userId = u.id
WHERE p.status IN ('PENDING', 'PENDING_MANUAL_REVIEW')
ORDER BY p.createdAt ASC;
```

### Check Payout History
```sql
SELECT p.*, d.stripeAccountId, u.name as driverName
FROM Payout p
JOIN Driver d ON p.driverId = d.id
JOIN User u ON d.userId = u.id
WHERE p.createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY p.createdAt DESC;
```

### Audit Trail
```sql
SELECT * FROM AuditLog
WHERE action = 'PAYOUT_PROCESSED'
ORDER BY createdAt DESC
LIMIT 50;
```

## Production Checklist

- [ ] Set `ALLOW_AUTO_PAYOUTS=false` (default)
- [ ] Set `DISABLE_PAYOUTS=false` to enable manual processing
- [ ] Configure Stripe Connect for drivers
- [ ] Set up admin monitoring dashboard
- [ ] Enable audit logging
- [ ] Test idempotency behavior
- [ ] Set up alerts for failed payouts
- [ ] Document manual approval SOP

## Notes

- **No automatic completion**: All payouts require manual admin action
- **Stripe test mode**: Use test keys for development
- **Idempotency**: Safe to retry failed requests
- **Audit trail**: All actions logged with admin ID
