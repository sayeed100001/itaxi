
import React, { useState, useEffect } from 'react';
import { MapBackground } from '../../components/Map/MapBackground';
import { Button } from '../../components/ui/Button';
import { useAppStore } from '../../store';
import { Power, Settings, Navigation, CheckCircle, XCircle, MapPin, Clock, ArrowRight, Flag, Upload, ShieldAlert } from 'lucide-react';
import { socketService } from '../../services/socketService';
import { Ride, RouteData, DriverMarker } from '../../types';
import { RoutingManager } from '../../services/routing/RoutingManager';
import { apiFetch } from '../../services/api';

export const DriverHome: React.FC = () => {
    const activeRide = useAppStore((state) => state.activeRide);
    const startRide = useAppStore((state) => state.startRide);
    const updateRideStatus = useAppStore((state) => state.updateRideStatus);
    const completeRide = useAppStore((state) => state.completeRide);
    const registerDriver = useAppStore((state) => state.registerDriver);
    const userLocation = useAppStore((state) => state.userLocation);
    const openChat = useAppStore((state) => state.openChat);
    const transactions = useAppStore((state) => state.transactions);
    const driverCreditBalance = useAppStore((state) => state.driverCreditBalance);
    const adminSettings = useAppStore((state) => state.adminSettings);
    const incomingRequest = useAppStore((state) => state.incomingRequest);
    const setIncomingRideRequest = useAppStore((state) => state.setIncomingRideRequest);
    const user = useAppStore((state) => state.user);
    const addToast = useAppStore((state) => state.addToast);

    const updateUserLocation = useAppStore((state) => state.updateUserLocation);

    const [isOnline, setIsOnline] = useState(false);
    const [pricing, setPricing] = useState({ base: 50, perKm: 20 });
    const [showSettings, setShowSettings] = useState(false);
    const [pickupRoute, setPickupRoute] = useState<RouteData | null>(null);
    const [showKycModal, setShowKycModal] = useState(false);
    const [kycSubmitting, setKycSubmitting] = useState(false);
    const [kycFiles, setKycFiles] = useState<{ nationalId?: File; drivingLicense?: File; criminalRecord?: File }>({});

    // Load pricing from user/driver data
    useEffect(() => {
        const loadPricing = async () => {
            if (!user?.id) return;
            try {
                const res = await apiFetch(`/api/drivers?lat=0&lng=0`);
                if (res.ok) {
                    const drivers = await res.json();
                    const myDriver = drivers.find((d: any) => d.id === user.id);
                    if (myDriver) {
                        setPricing({
                            base: Number.parseFloat(myDriver.base_fare ?? myDriver.baseFare ?? '50') || 50,
                            perKm: Number.parseFloat(myDriver.per_km_rate ?? myDriver.perKmRate ?? '20') || 20
                        });
                    }
                }
            } catch {
                // Non-fatal: fall back to defaults
            }
        };
        loadPricing();
    }, [user?.id]);

    const handleUpdatePricing = async () => {
        if (!user?.id) return;
        try {
            const res = await apiFetch(`/api/drivers/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify({ baseFare: pricing.base, perKmRate: pricing.perKm })
            });
            if (res.ok) {
                addToast('success', 'Pricing updated');
                setShowSettings(false);
            } else {
                addToast('error', 'Failed to update pricing');
            }
        } catch {
            addToast('error', 'Failed to update pricing');
        }
    };

    // Poll for incoming ride requests when online (replaces socket on Vercel)
    useEffect(() => {
        if (!isOnline || !user?.id) return;
        const poll = async () => {
            try {
                const res = await apiFetch(`/api/rides/pending?driverId=${user.id}`);
                if (!res.ok) return;
                const data = await res.json();
                const ride = Array.isArray(data) ? data[0] : null;
                if (ride && ride.id !== incomingRequest?.id) {
                    useAppStore.getState().setIncomingRideRequest(ride);
                } else if (!ride && incomingRequest) {
                    useAppStore.getState().setIncomingRideRequest(null);
                }
            } catch {}
        };
        poll();
        const id = setInterval(poll, 5000);
        return () => clearInterval(id);
    }, [isOnline, user?.id, incomingRequest?.id]);

    // Calculate today's earnings
    const todayEarnings = transactions
        .filter(t => t.type === 'credit' && t.status === 'completed' && new Date(t.date).toDateString() === new Date().toDateString())
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Toggle Online/Offline State & Location Sync
    useEffect(() => {
        let watchId: number | undefined;
        let lastUpdate = 0;
        const UPDATE_INTERVAL = 3000; // Update every 3 seconds
        let cancelled = false;

        if (isOnline) {
            const startOnline = async () => {
                if (!user?.id) return;

                const kyc = (user as any)?.kycStatus || 'unverified';
                if (kyc !== 'approved') {
                    addToast('warning', 'Complete KYC approval before going online.');
                    if (!cancelled) setIsOnline(false);
                    return;
                }

                try {
                    const res = await apiFetch(`/api/drivers/${user.id}/status`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: 'available' })
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => null);
                        addToast('error', err?.error || 'Failed to go online');
                        if (!cancelled) setIsOnline(false);
                        return;
                    }
                } catch {
                    addToast('error', 'Failed to go online');
                    if (!cancelled) setIsOnline(false);
                    return;
                }

                if (cancelled) return;

                const rawTaxiType = (((user as any)?.taxiTypeId || (user as any)?.taxi_type || 'eco') as any).toString();
                const normalizedTaxiType = (['eco', 'plus', 'lux', 'premium'] as const).includes(rawTaxiType)
                    ? (rawTaxiType as 'eco' | 'plus' | 'lux' | 'premium')
                    : 'eco';

                // Register driver on server/store
                const driverData: DriverMarker = {
                    id: user.id,
                    name: user?.name || 'You (Driver)',
                    vehicle: 'Vehicle',
                    rating: 4.9,
                    location: userLocation,
                    status: 'available',
                    type: normalizedTaxiType,
                    baseFare: pricing.base,
                    perKmRate: pricing.perKm,
                    eta: 1,
                    phone: user?.phone || ''
                };
                registerDriver(driverData);

                // Start Location Watch with throttling
                if (navigator.geolocation) {
                    watchId = navigator.geolocation.watchPosition(
                        (position) => {
                            const now = Date.now();
                            if (now - lastUpdate < UPDATE_INTERVAL) return;

                            lastUpdate = now;
                            const { latitude, longitude } = position.coords;
                            const location = { lat: latitude, lng: longitude };

                            // Update local store
                            updateUserLocation(location);

                            // Emit location update to server
                            socketService.emit('update_location', {
                                driverId: user.id,
                                location,
                                rideId: activeRide?.id
                            });
                        },
                        (error) => console.error("Location watch error:", error),
                        { enableHighAccuracy: true, maximumAge: 0 }
                    );
                }
            };

            startOnline();
        }

        return () => {
            cancelled = true;
            if (typeof watchId === 'number') navigator.geolocation.clearWatch(watchId);
        };
    }, [isOnline, pricing, user, activeRide?.id]);

    useEffect(() => {
        if (!user?.id) return;
        if (!isOnline) {
            apiFetch(`/api/drivers/${user.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'offline' })
            }).catch(() => {});
        }
    }, [isOnline, user?.id]);

    const kycStatus = (user as any)?.kycStatus || 'unverified';
    const driverLevel = (user as any)?.driverLevel || 'basic';

    // Calculate route to pickup when accepted
    useEffect(() => {
        const calculatePickupRoute = async () => {
            if (activeRide?.status === 'accepted') {
                try {
                    // Route from Driver Current Loc to Pickup
                    const route = await RoutingManager.getRoute(userLocation, activeRide.pickupLocation, adminSettings);
                    setPickupRoute(route);
                } catch (e) {
                    console.error("Failed to calc pickup route", e);
                }
            } else {
                setPickupRoute(null);
            }
        };
        calculatePickupRoute();
    }, [activeRide?.status]);

    const handleAccept = () => {
        if (!incomingRequest) return;
        if (!user?.id) {
            addToast('error', 'Not authenticated. Please log in again.');
            return;
        }

        socketService.emit('accept_ride', { rideId: incomingRequest.id, driverId: user.id });
        addToast('info', 'Accepting ride...');
    };

    const handleReject = () => {
        setIncomingRideRequest(null);
    };

    const handleStatusUpdate = (newStatus: Ride['status']) => {
        if (!activeRide) return;
        
        if (newStatus === 'completed') {
            updateRideStatus('completed');
            completeRide();
        } else {
            updateRideStatus(newStatus);
        }
    };

    const handleContactRider = () => {
        openChat(activeRide?.riderId || 'u1', 'Rider', 'Rider');
    };

    // Determine which route to show
    // If Accepted/Arrived -> Show route to Pickup (Calculated locally)
    // If In_Progress -> Show activeRide.route (Which is Pickup to Destination)
    const displayedRoute = activeRide?.status === 'in_progress' ? activeRide.route : pickupRoute;

    return (
        <div className="absolute inset-0 w-full">
            <MapBackground 
                isDriverView={true} 
                pickup={activeRide?.pickupLocation} 
                destination={activeRide?.destinationLocation} 
                route={displayedRoute}
                center={userLocation} // Follow driver
            />

            {/* Header: Status + Earnings */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between animate-fade-in">
                <div className="flex gap-3">
                    <button 
                        onClick={() => {
                            if (!isOnline && kycStatus !== 'approved') {
                                addToast('warning', 'Complete KYC approval before going online.');
                                setShowKycModal(true);
                                return;
                            }
                            setIsOnline(!isOnline);
                        }}
                        className={`px-5 py-2.5 rounded-2xl font-bold shadow-glass backdrop-blur-md flex items-center gap-2 transition-all duration-300 border ${isOnline ? 'bg-brand-500/90 text-white border-brand-400/50 shadow-glow' : 'bg-white/90 dark:bg-dark-900/90 text-dark-500 border-white/20 dark:border-white/10'}`}
                    >
                        <Power size={18} className={isOnline ? 'animate-pulse' : ''} />
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </button>
                    {isOnline && (
                        <>
                            <div className="px-5 py-2.5 rounded-2xl bg-white/90 dark:bg-dark-900/90 backdrop-blur-md shadow-glass border border-white/20 dark:border-white/10 font-mono font-bold text-dark-900 dark:text-white flex items-center gap-2">
                                <span className="text-[10px] text-dark-400 uppercase tracking-widest font-sans">Today</span> 
                                <span className="text-brand-600 dark:text-brand-400 text-lg">؋{todayEarnings}</span>
                            </div>
                            <div className="px-5 py-2.5 rounded-2xl bg-green-500/90 backdrop-blur-md shadow-glass border border-green-400/50 font-mono font-bold text-white flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-widest font-sans">Credit</span> 
                                <span className="text-lg">{Number(driverCreditBalance ?? 0).toFixed(0)}</span>
                            </div>
                        </>
                    )}
                </div>
                <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-12 h-12 bg-white/90 dark:bg-dark-900/90 backdrop-blur-md rounded-2xl shadow-glass border border-white/20 dark:border-white/10 flex items-center justify-center text-dark-900 dark:text-white transition-transform active:scale-95"
                >
                    <Settings size={22} />
                </button>
            </div>

            {/* KYC Banner */}
            {kycStatus !== 'approved' && (
                <div className="absolute top-20 left-4 right-4 z-20">
                    <div className="bg-yellow-50/95 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl p-4 backdrop-blur-xl shadow-glass flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="text-yellow-600 dark:text-yellow-400" size={22} />
                            <div>
                                <div className="font-bold text-dark-900 dark:text-white text-sm">KYC Status: {kycStatus}</div>
                                <div className="text-xs text-dark-500">Submit documents to activate full driver access. Level: {driverLevel}</div>
                            </div>
                        </div>
                        <Button size="sm" className="rounded-xl" icon={<Upload size={16} />} onClick={() => setShowKycModal(true)}>
                            Submit KYC
                        </Button>
                    </div>
                </div>
            )}

            {/* KYC Modal */}
            {showKycModal && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-dark-950 rounded-[28px] p-6 shadow-2xl border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="font-bold text-lg text-dark-900 dark:text-white">Submit KYC Documents</div>
                            <button onClick={() => setShowKycModal(false)} className="p-2 rounded-full hover:bg-dark-50 dark:hover:bg-white/5">
                                <XCircle size={20} className="text-dark-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-widest">National ID</label>
                                <input type="file" accept="image/*,application/pdf" onChange={(e) => setKycFiles(s => ({ ...s, nationalId: e.target.files?.[0] }))} className="w-full mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-widest">Driving License</label>
                                <input type="file" accept="image/*,application/pdf" onChange={(e) => setKycFiles(s => ({ ...s, drivingLicense: e.target.files?.[0] }))} className="w-full mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-widest">Criminal Record</label>
                                <input type="file" accept="image/*,application/pdf" onChange={(e) => setKycFiles(s => ({ ...s, criminalRecord: e.target.files?.[0] }))} className="w-full mt-1" />
                            </div>
                            <Button
                                size="lg"
                                className="w-full rounded-2xl"
                                isLoading={kycSubmitting}
                                onClick={async () => {
                                    if (!kycFiles.nationalId || !kycFiles.drivingLicense || !kycFiles.criminalRecord) {
                                        addToast('error', 'Please upload all required documents');
                                        return;
                                    }
                                    try {
                                        setKycSubmitting(true);
                                        const fd = new FormData();
                                        fd.append('nationalId', kycFiles.nationalId);
                                        fd.append('drivingLicense', kycFiles.drivingLicense);
                                        fd.append('criminalRecord', kycFiles.criminalRecord);
                                        const res = await apiFetch('/api/background-check/submit', { method: 'POST', body: fd, headers: {} });
                                        if (!res.ok) {
                                            const err = await res.json().catch(() => ({ error: 'Submit failed' }));
                                            throw new Error(err.error || 'Submit failed');
                                        }
                                        addToast('success', 'KYC submitted. Pending review.');
                                        setShowKycModal(false);
                                        // Refresh session so kycStatus is up-to-date
                                        const token = localStorage.getItem('token');
                                        if (token) {
                                            const v = await apiFetch('/api/auth/verify', { method: 'POST' });
                                            if (v.ok) {
                                                const data = await v.json();
                                                useAppStore.getState().setUser(data.user);
                                            }
                                        }
                                    } catch (e: any) {
                                        addToast('error', e?.message || 'KYC submit failed');
                                    } finally {
                                        setKycSubmitting(false);
                                    }
                                }}
                            >
                                Submit
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pricing Settings Modal */}
            {showSettings && (
                <div className="absolute top-20 right-4 w-80 bg-white/95 dark:bg-dark-950/95 backdrop-blur-xl rounded-[24px] shadow-glass-dark border border-white/20 dark:border-white/10 p-6 z-20 animate-slide-up">
                    <h3 className="font-display font-bold text-dark-900 dark:text-white mb-6 text-xl tracking-tight">My Pricing</h3>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-2 block">Base Fare (AFN)</label>
                            <div className="flex items-center bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl px-4 py-1 transition-colors focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
                                <span className="font-mono font-bold text-dark-400 text-lg">؋</span>
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent p-2 text-xl font-mono font-bold text-dark-900 dark:text-white focus:outline-none"
                                    value={pricing.base}
                                    onChange={e => setPricing({...pricing, base: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-2 block">Per KM (AFN)</label>
                            <div className="flex items-center bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl px-4 py-1 transition-colors focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
                                <span className="font-mono font-bold text-dark-400 text-lg">؋</span>
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent p-2 text-xl font-mono font-bold text-dark-900 dark:text-white focus:outline-none"
                                    value={pricing.perKm}
                                    onChange={e => setPricing({...pricing, perKm: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                        <Button size="lg" onClick={handleUpdatePricing} className="w-full mt-4 rounded-xl font-bold shadow-glow bg-brand-500 hover:bg-brand-600">Update Rates</Button>
                    </div>
                </div>
            )}

            {/* Main Action Button (Go Online Overlay) */}
            {!isOnline && !activeRide && (
                <div className="absolute inset-0 z-10 bg-dark-950/60 backdrop-blur-md flex items-center justify-center animate-fade-in">
                     <button 
                        onClick={() => {
                            if (kycStatus !== 'approved') {
                                addToast('warning', 'Complete KYC approval before going online.');
                                setShowKycModal(true);
                                return;
                            }
                            setIsOnline(true);
                        }}
                        className="w-40 h-40 rounded-full bg-brand-500 border-[8px] border-brand-500/30 shadow-glow flex flex-col items-center justify-center text-white font-bold hover:scale-105 transition-all duration-300 group"
                     >
                        <span className="text-4xl font-display font-black tracking-tight group-hover:scale-110 transition-transform">GO</span>
                        <span className="text-xs font-bold tracking-widest opacity-90 mt-1">ONLINE</span>
                    </button>
                </div>
            )}

            {/* Incoming Request Overlay */}
            {incomingRequest && (
                <div className="absolute inset-0 z-50 bg-dark-950/80 backdrop-blur-md flex items-end md:items-center justify-center p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-white dark:bg-dark-950 rounded-[32px] p-8 shadow-glass-dark animate-slide-up border border-white/10 relative overflow-hidden">
                         <div className="absolute top-0 left-0 h-1.5 bg-brand-500 animate-[width_20s_linear_forwards] w-full" style={{ width: '0%' }}></div>
                         
                         <div className="text-center mb-8 pt-4">
                            <div className="inline-block bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 shadow-sm border border-brand-100 dark:border-brand-500/20">NEW REQUEST</div>
                            <div className="text-6xl font-mono font-black text-dark-900 dark:text-white mb-2 tracking-tighter">؋{incomingRequest.proposedFare || incomingRequest.fare}</div>
                            <div className="flex items-center justify-center gap-3 text-sm text-dark-500 font-medium">
                                <span className="bg-dark-50 dark:bg-white/5 px-3 py-1 rounded-lg">{(incomingRequest.distance / 1000).toFixed(1)} km</span>
                                <span className="bg-dark-50 dark:bg-white/5 px-3 py-1 rounded-lg capitalize">{incomingRequest.serviceType}</span>
                            </div>
                            {incomingRequest.notes && (
                                <div className="mt-4 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-xl text-sm font-medium border border-yellow-200 dark:border-yellow-500/20">
                                    "{incomingRequest.notes}"
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-4 mb-10">
                            <div className="flex items-start gap-4 p-5 bg-dark-50 dark:bg-white/5 rounded-[20px] border border-dark-100 dark:border-white/5 shadow-sm">
                                <div className="mt-1 w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Pickup</div>
                                    <div className="font-bold text-dark-900 dark:text-white text-lg leading-tight">Current Location</div>
                                    <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-1.5 flex items-center gap-1.5"><Clock size={12} /> {incomingRequest.duration ? Math.round(incomingRequest.duration / 60) : 3} mins away</div>
                                </div>
                            </div>
                             <div className="flex items-start gap-4 p-5 bg-dark-50 dark:bg-white/5 rounded-[20px] border border-dark-100 dark:border-white/5 shadow-sm">
                                <div className="mt-1 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Dropoff</div>
                                    <div className="font-bold text-dark-900 dark:text-white text-lg leading-tight">{incomingRequest.destination}</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="secondary" className="h-16 rounded-2xl text-lg font-bold bg-dark-50 dark:bg-white/5 text-dark-600 dark:text-dark-300 border-transparent hover:bg-dark-100 dark:hover:bg-white/10" onClick={handleReject} icon={<XCircle size={20}/>}>Reject</Button>
                            <Button className="h-16 rounded-2xl text-lg font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-glow border-transparent" onClick={handleAccept} icon={<CheckCircle size={20}/>}>Accept</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Ride Controls */}
            {activeRide && (
                <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-dark-950/95 backdrop-blur-xl p-8 pb-28 rounded-t-[32px] shadow-fintech dark:shadow-glass-dark z-20 animate-slide-up border-t border-white/20 dark:border-white/10">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="font-display font-bold text-2xl text-dark-900 dark:text-white mb-2 tracking-tight">
                                {activeRide.status === 'accepted' ? 'Picking up Rider' :
                                 activeRide.status === 'arrived' ? 'Waiting for Rider' :
                                 activeRide.status === 'in_progress' ? 'Driving to Destination' : 'Trip'}
                            </h3>
                            <div className="flex items-center gap-2 text-sm font-medium text-dark-500">
                                <span className="w-2.5 h-2.5 rounded-full bg-brand-500 shadow-glow animate-pulse"></span>
                                {activeRide.status === 'in_progress' ? 'En Route' : 'Navigating'}
                            </div>
                        </div>
                        <Button size="lg" className="rounded-2xl bg-dark-50 dark:bg-white/5 text-dark-900 dark:text-white border-transparent shadow-sm" icon={<Navigation size={18}/>} onClick={handleContactRider}>Contact</Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {activeRide.status === 'accepted' && (
                            <Button 
                                className="h-16 rounded-2xl text-lg font-bold w-full bg-brand-500 hover:bg-brand-600 text-white shadow-glow" 
                                onClick={() => handleStatusUpdate('arrived')}
                                icon={<MapPin size={22}/>}
                            >
                                Arrived at Pickup
                            </Button>
                        )}

                        {activeRide.status === 'arrived' && (
                            <Button 
                                className="h-16 rounded-2xl text-lg font-bold w-full bg-blue-600 hover:bg-blue-700 text-white shadow-glow" 
                                onClick={() => handleStatusUpdate('in_progress')}
                                icon={<ArrowRight size={22}/>}
                            >
                                Start Trip
                            </Button>
                        )}

                        {activeRide.status === 'in_progress' && (
                            <Button 
                                className="h-16 rounded-2xl text-lg font-bold w-full bg-dark-900 dark:bg-white text-white dark:text-dark-900 hover:bg-dark-800 dark:hover:bg-dark-100 shadow-glass" 
                                onClick={() => handleStatusUpdate('completed')}
                                icon={<Flag size={22}/>}
                            >
                                Complete Trip
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
