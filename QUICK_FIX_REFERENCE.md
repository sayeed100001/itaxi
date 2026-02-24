# Quick Fix Reference Card

## Problem: Landing page doesn't show in new browser

**Solution**: App.tsx now properly handles unauthenticated state
```typescript
// Shows landing for new users
if (appMode === 'landing' && !user) {
    return <LandingPage />;
}

// Validates token on mount
useEffect(() => {
    const token = localStorage.getItem('token');
    if (user && !token) {
        logout(); // Clear invalid session
    }
}, []);
```

**Test**: Open `http://localhost:3000` in incognito → Should show landing page

---

## Problem: Admin gets 403 when requesting taxi

**Solution**: Updated authorization to allow ADMIN role

**Backend** (`server/src/routes/trip.routes.ts`):
```typescript
// Changed from requireRider to authorize
router.post('/', authorize('RIDER', 'ADMIN'), validate(createTripSchema), tripController.createTrip);
```

**Frontend** (`App.tsx`):
```typescript
// Allow ADMIN to access RiderHome
<ProtectedRoute allowedRoles={['RIDER', 'ADMIN']}>
    <RiderHome />
</ProtectedRoute>
```

**Frontend** (`pages/Rider/RiderHome.tsx`):
```typescript
// Validate role before request
if (user.role !== 'RIDER' && user.role !== 'ADMIN') {
    addToast('error', 'Only riders and admins can request rides');
    return;
}
```

**Test**: Login as admin (+93700000000/admin123) → Request ride → Should work

---

## Problem: Logout doesn't clear role

**Solution**: Updated logout to reset currentRole
```typescript
logout: () => set({ 
    user: null, 
    currentRole: null,  // Added this
    appMode: 'landing',
    // ... rest
}),
```

**Test**: Login → Logout → Should return to landing page with clean state

---

## Files Modified

1. `App.tsx` - Landing page logic, admin access, token validation
2. `store.ts` - Logout function
3. `server/src/routes/trip.routes.ts` - Admin authorization
4. `pages/Rider/RiderHome.tsx` - Role validation

---

## Testing Commands

```bash
# Run full system test
.\test-system.bat

# Start servers
.\run.bat

# Seed sample data
cd server
npm run seed
```

---

## Sample Credentials

```
Admin (Password Login):
  Phone: +93700000000
  Password: admin123
  Can: Request rides, access admin panel

Rider (OTP Login):
  Phone: +93700000001
  OTP: any 6 digits (dev mode)
  Can: Request rides only

Driver (OTP Login):
  Phone: +93700000010
  OTP: any 6 digits (dev mode)
  Can: Accept rides only
```

---

## Common Issues

**Q: Still seeing login instead of landing?**
A: Clear browser cache and localStorage, or use incognito mode

**Q: Admin still gets 403?**
A: Restart backend server after code changes

**Q: No drivers showing?**
A: Run `npm run seed` in server directory

**Q: Token expired error?**
A: Logout and login again

---

## Architecture Summary

```
Landing Page (unauthenticated)
    ↓
Login Page (OTP or Password)
    ↓
App Portal (authenticated)
    ├─ RIDER → RiderHome (request rides)
    ├─ DRIVER → DriverHome (accept rides)
    └─ ADMIN → AdminDashboard OR RiderHome (dispatch)
```

---

## Authorization Matrix

| Role   | Request Rides | Accept Rides | Admin Panel | Dispatch |
|--------|--------------|--------------|-------------|----------|
| RIDER  | ✅           | ❌           | ❌          | ❌       |
| DRIVER | ❌           | ✅           | ❌          | ❌       |
| ADMIN  | ✅           | ❌           | ✅          | ✅       |

---

**Last Updated**: 2024  
**Status**: All issues resolved ✅
