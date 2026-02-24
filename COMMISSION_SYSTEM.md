# iTaxi Commission-Based Credit System

## Overview
The credit system has been redesigned to work on a **commission-based model** where platform revenue comes from a percentage of each trip fare, not fixed credit purchases.

## Commission Split
- **20% Platform Commission** - Goes to iTaxi
- **80% Driver Earnings** - Goes to driver

## How It Works

### 1. Rider Requests Trip
- Rider suggests their own fare amount (e.g., 500 AFN)
- System calculates route and displays suggested fare
- Rider can adjust the fare amount

### 2. Driver Accepts Trip
**When driver accepts:**
- System calculates: `platformCommission = fare × 0.20` (e.g., 500 × 0.20 = 100 AFN)
- System calculates: `driverEarnings = fare × 0.80` (e.g., 500 × 0.80 = 400 AFN)
- **100 AFN is deducted from driver's credit balance** (20% commission)
- Trip status changes to ACCEPTED
- Trip record stores: `platformCommission: 100`, `driverEarnings: 400`

**Credit Balance Check:**
- Driver must have sufficient credits to cover the 20% commission
- If driver has 50 AFN credits but commission is 100 AFN → **Trip acceptance fails**
- Error: "Insufficient credits. Need 100 AFN (20% of 500 AFN fare) to accept this trip."

### 3. Trip Completion
**When trip is completed:**
- Rider's wallet is debited: 500 AFN
- **Driver's wallet is credited: 400 AFN** (80% earnings)
- Platform keeps: 100 AFN (already deducted from driver credits)
- Transaction records created for both debit and credit

### 4. Credit Ledger Tracking
Every commission deduction is logged in `DriverCreditLedger`:
```json
{
  "driverId": "driver-uuid",
  "tripId": "trip-uuid",
  "action": "TRIP_DEDUCTION",
  "creditsDelta": -100,
  "balanceAfter": 2900,
  "amountAfn": 100,
  "notes": "Platform commission (20% of 500 AFN fare). Driver earns 80% (400 AFN)."
}
```

## Database Schema Changes

### Trip Table (Updated)
```prisma
model Trip {
  id                  String   @id @default(uuid())
  fare                Float    // Total fare (e.g., 500 AFN)
  platformCommission  Float?   // 20% of fare (e.g., 100 AFN)
  driverEarnings      Float?   // 80% of fare (e.g., 400 AFN)
  // ... other fields
}
```

### Driver Table (Existing)
```prisma
model Driver {
  creditBalance    Int       // Credits in AFN (1 credit = 1 AFN)
  creditExpiresAt  DateTime? // Expiry date for credits
  // ... other fields
}
```

## Credit Purchase System

### How Drivers Buy Credits
1. Driver purchases credit package from admin (e.g., 3000 AFN for 30 days)
2. Admin approves purchase request
3. Credits added to `Driver.creditBalance` (e.g., 3000 credits)
4. Credits valid for specified duration (e.g., 30 days)

### Credit Usage
- Credits are used to pay platform commission (20% of each trip)
- Example: Driver with 3000 credits can accept trips worth up to 15,000 AFN total fare
  - 15,000 AFN × 20% = 3000 AFN commission
  - Driver earns: 15,000 AFN × 80% = 12,000 AFN

## Admin Revenue Tracking

### Finance Dashboard Shows:
- **Total Fares**: Sum of all completed trip fares
- **Platform Commission (20%)**: Total revenue for iTaxi
- **Driver Earnings (80%)**: Total paid to drivers
- **Completed Trips**: Number of trips

### Example Calculation:
```
Total Fares: 50,000 AFN (from 100 completed trips)
Platform Commission (20%): 10,000 AFN
Driver Earnings (80%): 40,000 AFN
```

## API Endpoints

### Trip Acceptance
```
POST /api/trips/:tripId/accept
Authorization: Bearer <driver-token>

Response:
{
  "success": true,
  "data": {
    "id": "trip-uuid",
    "fare": 500,
    "platformCommission": 100,
    "driverEarnings": 400,
    "status": "ACCEPTED"
  }
}
```

### Driver Stats
```
GET /api/admin/drivers/stats
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "revenue": {
      "totalCompletedTrips": 100,
      "totalFares": 50000,
      "platformCommission": 10000,
      "driverEarnings": 40000,
      "commissionRate": "20%",
      "driverRate": "80%"
    }
  }
}
```

## Frontend Display

### Admin Finance Page
Shows commission revenue breakdown:
- Total Fares from completed trips
- Platform Commission (20%)
- Driver Earnings (80%)
- Commission model explanation

### Driver Earnings Page
Shows driver's net earnings:
- All amounts shown are 80% share (after commission)
- Banner explains: "20% platform fee deducted on acceptance, 80% paid on completion"
- Earnings charts show net income only

### Driver Home (Trip Acceptance)
Before accepting trip:
- Shows total fare (e.g., 500 AFN)
- Shows commission that will be deducted (e.g., 100 AFN)
- Shows earnings driver will receive (e.g., 400 AFN)
- Validates credit balance before allowing acceptance

## Benefits

### For Platform (iTaxi)
- Revenue scales with trip volume
- Higher fare trips = higher commission
- Transparent revenue tracking
- Automatic commission collection

### For Drivers
- Only pay commission on actual trips
- Keep 80% of all earnings
- Credits last longer (only 20% deducted per trip)
- Clear earnings breakdown

### For Riders
- Flexible fare suggestions
- Transparent pricing
- No hidden fees

## Migration Notes

### Existing Trips
- Old trips without commission fields will show null
- New trips automatically calculate and store commission split
- Historical data remains intact

### Credit Balances
- Existing driver credit balances remain valid
- Credits now represent AFN amount for commission payment
- 1 credit = 1 AFN commission coverage

## Testing

### Test Scenarios
1. **Sufficient Credits**: Driver with 1000 credits accepts 500 AFN trip → Success (100 AFN deducted)
2. **Insufficient Credits**: Driver with 50 credits accepts 500 AFN trip → Fails with error
3. **Trip Completion**: 500 AFN trip completes → Rider debited 500, Driver credited 400
4. **Admin Stats**: Finance page shows correct commission breakdown
5. **Driver Earnings**: Earnings page shows 80% share only

### Sample Test Data
```sql
-- Driver with 3000 credits
UPDATE Driver SET creditBalance = 3000 WHERE id = 'driver-uuid';

-- Create test trip with 500 AFN fare
INSERT INTO Trip (fare, ...) VALUES (500, ...);

-- Accept trip (should deduct 100 AFN)
-- Complete trip (should credit driver 400 AFN)
```

## Future Enhancements

1. **Dynamic Commission Rates**: Allow admin to set different rates per city/service type
2. **Commission Tiers**: Lower rates for high-volume drivers
3. **Promotional Rates**: Temporary commission reductions for new drivers
4. **Commission Reports**: Detailed breakdown by driver, city, time period

---

**Implementation Date**: 2024-02-24  
**Status**: ✅ Fully Implemented  
**Version**: 2.0
