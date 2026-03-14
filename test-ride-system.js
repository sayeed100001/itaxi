// Runtime smoke test (auth + drivers + rides + chat threads + driver credit)
// Usage: `node test-ride-system.js` (requires server running on API_BASE)

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

const json = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const login = async (phone, password) => {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await json(res);
  if (!res.ok) throw new Error(`Login failed (${phone}): ${res.status} ${JSON.stringify(data)}`);
  return data;
};

const authed = (token) => async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return { res, data: await json(res) };
};

async function testRideSystem() {
  console.log('Running iTaxi runtime smoke test...\n');

  // 1) Health
  console.log('1) Health check...');
  {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await json(res);
    if (!res.ok) throw new Error(`Health check failed: ${res.status} ${JSON.stringify(data)}`);
    console.log('   OK:', data.status);
  }

  // 2) Login demo users
  console.log('\n2) Logging in demo accounts...');
  const admin = await login('+10000000000', 'admin123');
  const driver = await login('+10000000001', 'driver123');
  const rider = await login('+10000000002', 'rider123');
  console.log('   Admin :', admin.user?.id);
  console.log('   Driver:', driver.user?.id);
  console.log('   Rider :', rider.user?.id);

  const asAdmin = authed(admin.token);
  const asDriver = authed(driver.token);
  const asRider = authed(rider.token);

  // Ensure the demo driver is visible for rider discovery (status + last_updated freshness).
  console.log('\n2.1) Ensuring demo driver is online + has fresh location...');
  {
    const loc = await asAdmin('/api/drivers/location', {
      method: 'POST',
      body: JSON.stringify({ driverId: driver.user.id, lat: 34.5333, lng: 69.1667 }),
    });
    if (!loc.res.ok) throw new Error(`Driver location update failed: ${loc.res.status} ${JSON.stringify(loc.data)}`);

    const st = await asAdmin(`/api/drivers/${driver.user.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'available' }),
    });
    if (!st.res.ok) throw new Error(`Driver status update failed: ${st.res.status} ${JSON.stringify(st.data)}`);
    console.log('   OK');
  }

  // 3) Drivers nearby
  console.log('\n3) Fetch drivers nearby...');
  {
    const res = await fetch(`${API_BASE}/api/drivers?lat=34.5333&lng=69.1667`);
    const data = await json(res);
    if (!res.ok) throw new Error(`Drivers fetch failed: ${res.status} ${JSON.stringify(data)}`);
    const ids = Array.isArray(data) ? data.map((d) => d.id) : [];
    console.log(`   Found ${ids.length} drivers`);
    if (!ids.includes(driver.user?.id)) {
      throw new Error(`Demo driver not returned by /api/drivers (id=${driver.user?.id}). Check KYC/status/last_updated filters.`);
    }
  }

  // 4) Chat threads
  console.log('\n4) Fetch chat threads (rider)...');
  {
    const { res, data } = await asRider('/api/chat/threads');
    if (!res.ok) throw new Error(`Chat threads failed: ${res.status} ${JSON.stringify(data)}`);
    console.log(`   Threads: ${Array.isArray(data) ? data.length : 0}`);
  }

  // 5) Driver credit
  console.log('\n5) Check driver credit (admin)...');
  let creditBefore = null;
  {
    const { res, data } = await asAdmin(`/api/driver-credit/${driver.user.id}`);
    if (!res.ok) throw new Error(`Driver credit fetch failed: ${res.status} ${JSON.stringify(data)}`);
    creditBefore = Number(data.balance);
    console.log('   Balance:', creditBefore);
  }

  // 6) Create ride
  console.log('\n6) Create ride (rider)...');
  let rideId = null;
  let rideFare = null;
  {
    const rideData = {
      riderId: rider.user.id,
      pickup: 'Current Location',
      destination: 'Test Destination',
      pickupLoc: { lat: 34.5333, lng: 69.1667 },
      destLoc: { lat: 34.54, lng: 69.17 },
      serviceType: 'city',
      taxiTypeId: 'plus',
      proposedFare: 200,
    };

    const { res, data } = await asRider('/api/rides', {
      method: 'POST',
      body: JSON.stringify(rideData),
    });

    if (!res.ok) throw new Error(`Ride create failed: ${res.status} ${JSON.stringify(data)}`);
    rideId = data.id;
    rideFare = Number(data.fare);
    console.log('   Ride:', rideId, 'Fare:', rideFare);
  }

  // 7) Driver accepts + completes
  console.log('\n7) Driver accepts + completes ride...');
  for (const st of ['accepted', 'arrived', 'in_progress', 'completed']) {
    const body = st === 'accepted' ? { status: st, driverId: driver.user.id } : { status: st };
    const { res, data } = await asDriver(`/api/rides/${rideId}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ride status ${st} failed: ${res.status} ${JSON.stringify(data)}`);
    console.log('   Status ->', data.status);
  }

  // 8) Validate credit deduction (~20% commission)
  console.log('\n8) Validate credit deduction...');
  {
    const { res, data } = await asAdmin(`/api/driver-credit/${driver.user.id}`);
    if (!res.ok) throw new Error(`Driver credit fetch failed: ${res.status} ${JSON.stringify(data)}`);

    const after = Number(data.balance);
    const commission = Number.isFinite(rideFare) ? rideFare * 0.2 : null;
    console.log('   Before:', creditBefore, 'After:', after, 'Expected commission ~', commission);

    if (Number.isFinite(creditBefore) && Number.isFinite(after) && Number.isFinite(commission)) {
      const delta = creditBefore - after;
      if (delta < commission - 1 || delta > commission + 1) {
        throw new Error(`Unexpected credit delta: ${delta} (expected ~${commission})`);
      }
    }
  }

  console.log('\nAll runtime smoke tests passed.');
}

testRideSystem().catch((e) => {
  console.error('\nSMOKE TEST FAILED:\n', e?.message || e);
  process.exit(1);
});
